const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle: {
		Primary,
		Secondary,
	},
	EmbedBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} = require('discord.js');
const emoji = require('node-emoji');
const { logAdminEvent } = require('../../../../../lib/logging');

/**
 * Build panel embed based on panel data and guild settings
 */
function buildPanelEmbed(panel, settings, guild) {
	const embed = new EmbedBuilder()
		.setColor(settings.primaryColour);

	if (settings.footer) {
		embed.setFooter({
			iconURL: guild.iconURL(),
			text: settings.footer,
		});
	}

	if (panel.title) embed.setTitle(panel.title);
	if (panel.description) embed.setDescription(panel.description);
	if (panel.image) embed.setImage(panel.image);
	if (panel.thumbnail) embed.setThumbnail(panel.thumbnail);

	return embed;
}

/**
 * Build panel components based on panel type and categories
 */
function buildPanelComponents(panel, categories, getMessage) {
	if (panel.type === 'MESSAGE') {
		return null;
	}

	const components = [];

	if (categories.length === 1) {
		components.push(
			new ButtonBuilder()
				.setCustomId(JSON.stringify({
					action: 'create',
					target: categories[0].id,
				}))
				.setStyle(Primary)
				.setLabel(getMessage('buttons.create.text'))
				.setEmoji(getMessage('buttons.create.emoji')),
		);
	} else if (panel.type === 'BUTTON') {
		components.push(
			...categories.map(category =>
				new ButtonBuilder()
					.setCustomId(JSON.stringify({
						action: 'create',
						target: category.id,
					}))
					.setStyle(Secondary)
					.setLabel(category.name)
					.setEmoji(emoji.hasEmoji(category.emoji) ? emoji.get(category.emoji) : { id: category.emoji }),
			),
		);
	} else {
		components.push(
			new StringSelectMenuBuilder()
				.setCustomId(JSON.stringify({ action: 'create' }))
				.setPlaceholder(getMessage('menus.category.placeholder'))
				.setOptions(
					categories.map(category =>
						new StringSelectMenuOptionBuilder()
							.setValue(String(category.id))
							.setLabel(category.name)
							.setDescription(category.description)
							.setEmoji(emoji.hasEmoji(category.emoji) ? emoji.get(category.emoji) : { id: category.emoji }),
					),
				),
		);
	}

	return [new ActionRowBuilder().setComponents(components)];
}

/**
 * GET /api/admin/guilds/:guild/panels - List all panels for a guild
 */
module.exports.get = fastify => ({
	handler: async (req, res) => {
		/** @type {import('client')} */
		const client = req.routeOptions.config.client;
		const guildId = req.params.guild;

		const panels = await client.prisma.panel.findMany({
			where: { guildId },
			include: {
				messages: {
					select: {
						id: true,
						channelId: true,
						messageId: true,
					},
				},
			},
			orderBy: { createdAt: 'desc' },
		});

		return panels;
	},
	onRequest: [fastify.authenticate, fastify.isAdmin],
});

/**
 * POST /api/admin/guilds/:guild/panels - Create a new panel
 */
module.exports.post = fastify => ({
	handler: async (req, res) => {
		/** @type {import('client')} */
		const client = req.routeOptions.config.client;
		const guildId = req.params.guild;
		const data = req.body;

		if (!data.name) {
			return res.code(400).send({ error: 'Panel name is required' });
		}

		if (!data.categories || data.categories.length === 0) {
			return res.code(400).send({ error: 'At least one category is required' });
		}

		const existingPanel = await client.prisma.panel.findUnique({
			where: {
				guildId_name: {
					guildId,
					name: data.name,
				},
			},
		});

		if (existingPanel) {
			return res.code(400).send({ error: 'A panel with this name already exists' });
		}

		const panel = await client.prisma.panel.create({
			data: {
				guildId,
				name: data.name,
				title: data.title || null,
				description: data.description || null,
				image: data.image || null,
				thumbnail: data.thumbnail || null,
				type: data.type || 'BUTTON',
				categories: JSON.stringify(data.categories),
			},
		});

		logAdminEvent(client, {
			action: 'create',
			guildId,
			target: {
				id: panel.id.toString(),
				name: panel.name,
				type: 'panel',
			},
			userId: req.user.id,
		});

		return panel;
	},
	onRequest: [fastify.authenticate, fastify.isAdmin],
});

/**
 * PUT /api/admin/guilds/:guild/panels - Update an existing panel and all its messages
 */
module.exports.put = fastify => ({
	handler: async (req, res) => {
		/** @type {import('client')} */
		const client = req.routeOptions.config.client;
		const guild = client.guilds.cache.get(req.params.guild);
		const guildId = req.params.guild;
		const data = req.body;

		if (!data.id) {
			return res.code(400).send({ error: 'Panel ID is required' });
		}

		const existingPanel = await client.prisma.panel.findFirst({
			where: {
				id: data.id,
				guildId,
			},
			include: {
				messages: true,
			},
		});

		if (!existingPanel) {
			return res.code(404).send({ error: 'Panel not found' });
		}

		if (data.name && data.name !== existingPanel.name) {
			const duplicateName = await client.prisma.panel.findUnique({
				where: {
					guildId_name: {
						guildId,
						name: data.name,
					},
				},
			});
			if (duplicateName) {
				return res.code(400).send({ error: 'A panel with this name already exists' });
			}
		}

		const updatedPanel = await client.prisma.panel.update({
			where: { id: data.id },
			data: {
				name: data.name ?? existingPanel.name,
				title: data.title !== undefined ? data.title : existingPanel.title,
				description: data.description !== undefined ? data.description : existingPanel.description,
				image: data.image !== undefined ? data.image : existingPanel.image,
				thumbnail: data.thumbnail !== undefined ? data.thumbnail : existingPanel.thumbnail,
				type: data.type ?? existingPanel.type,
				categories: data.categories ? JSON.stringify(data.categories) : existingPanel.categories,
			},
			include: {
				messages: true,
			},
		});

		const settings = await client.prisma.guild.findUnique({
			select: {
				categories: true,
				footer: true,
				locale: true,
				primaryColour: true,
			},
			where: { id: guildId },
		});

		const getMessage = client.i18n.getLocale(settings.locale);

		const categoryIds = typeof updatedPanel.categories === 'string'
			? JSON.parse(updatedPanel.categories)
			: updatedPanel.categories;

		const categories = categoryIds.map(id => {
			const category = settings.categories.find(c => c.id === id);
			return category;
		}).filter(Boolean);

		const embed = buildPanelEmbed(updatedPanel, settings, guild);
		const components = buildPanelComponents(updatedPanel, categories, getMessage);

		const updateResults = [];
		const messagesToDelete = [];

		for (const panelMessage of existingPanel.messages) {
			try {
				const channel = await client.channels.fetch(panelMessage.channelId).catch(() => null);
				if (!channel) {
					messagesToDelete.push(panelMessage.id);
					continue;
				}

				const message = await channel.messages.fetch(panelMessage.messageId).catch(() => null);
				if (!message) {
					messagesToDelete.push(panelMessage.id);
					continue;
				}

				const editPayload = { embeds: [embed] };
				if (components) {
					editPayload.components = components;
				} else {
					editPayload.components = [];
				}

				await message.edit(editPayload);
				updateResults.push({
					channelId: panelMessage.channelId,
					messageId: panelMessage.messageId,
					status: 'updated',
				});
			} catch (error) {
				client.log.warn.panels(`Failed to update panel message ${panelMessage.messageId}: ${error.message}`);
				updateResults.push({
					channelId: panelMessage.channelId,
					messageId: panelMessage.messageId,
					status: 'failed',
					error: error.message,
				});
			}
		}

		if (messagesToDelete.length > 0) {
			await client.prisma.panelMessage.deleteMany({
				where: {
					id: { in: messagesToDelete },
				},
			});
		}

		logAdminEvent(client, {
			action: 'update',
			guildId,
			target: {
				id: updatedPanel.id.toString(),
				name: updatedPanel.name,
				type: 'panel',
			},
			userId: req.user.id,
		});

		return {
			panel: updatedPanel,
			messageUpdates: updateResults,
			deletedMessages: messagesToDelete.length,
		};
	},
	onRequest: [fastify.authenticate, fastify.isAdmin],
});

/**
 * DELETE /api/admin/guilds/:guild/panels - Delete a panel
 */
module.exports.delete = fastify => ({
	handler: async (req, res) => {
		/** @type {import('client')} */
		const client = req.routeOptions.config.client;
		const guildId = req.params.guild;
		const { id } = req.body;

		if (!id) {
			return res.code(400).send({ error: 'Panel ID is required' });
		}

		const panel = await client.prisma.panel.findFirst({
			where: {
				id,
				guildId,
			},
			include: {
				messages: true,
			},
		});

		if (!panel) {
			return res.code(404).send({ error: 'Panel not found' });
		}

		for (const panelMessage of panel.messages) {
			try {
				const channel = await client.channels.fetch(panelMessage.channelId).catch(() => null);
				if (channel) {
					const message = await channel.messages.fetch(panelMessage.messageId).catch(() => null);
					if (message) {
						await message.delete().catch(() => null);
					}
				}
			} catch (error) {
				client.log.warn.panels(`Failed to delete panel message ${panelMessage.messageId}: ${error.message}`);
			}
		}

		await client.prisma.panel.delete({
			where: { id },
		});

		logAdminEvent(client, {
			action: 'delete',
			guildId,
			target: {
				id: panel.id.toString(),
				name: panel.name,
				type: 'panel',
			},
			userId: req.user.id,
		});

		return { success: true };
	},
	onRequest: [fastify.authenticate, fastify.isAdmin],
});

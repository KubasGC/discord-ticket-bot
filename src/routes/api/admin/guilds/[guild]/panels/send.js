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
const { logAdminEvent } = require('../../../../../../lib/logging');

/**
 * POST /api/admin/guilds/:guild/panels/send - Send a panel to a channel
 */
module.exports.post = fastify => ({
	handler: async (req, res) => {
		/** @type {import('client')} */
		const client = req.routeOptions.config.client;
		const guild = client.guilds.cache.get(req.params.guild);
		const guildId = req.params.guild;
		const { panelId, channelId } = req.body;

		if (!panelId) {
			return res.code(400).send({ error: 'Panel ID is required' });
		}

		if (!channelId) {
			return res.code(400).send({ error: 'Channel ID is required' });
		}

		const panel = await client.prisma.panel.findFirst({
			where: {
				id: panelId,
				guildId,
			},
		});

		if (!panel) {
			return res.code(404).send({ error: 'Panel not found' });
		}

		const channel = await client.channels.fetch(channelId).catch(() => null);
		if (!channel) {
			return res.code(404).send({ error: 'Channel not found' });
		}

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

		const categoryIds = typeof panel.categories === 'string'
			? JSON.parse(panel.categories)
			: panel.categories;

		const categories = categoryIds.map(id => {
			const category = settings.categories.find(c => c.id === id);
			return category;
		}).filter(Boolean);

		if (categories.length === 0) {
			return res.code(400).send({ error: 'Panel has no valid categories' });
		}

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

		let message;

		if (panel.type === 'MESSAGE') {
			message = await channel.send({ embeds: [embed] });
		} else {
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

			message = await channel.send({
				components: [
					new ActionRowBuilder()
						.setComponents(components),
				],
				embeds: [embed],
			});
		}

		await client.prisma.panelMessage.create({
			data: {
				panelId: panel.id,
				channelId: channel.id,
				messageId: message.id,
			},
		});

		logAdminEvent(client, {
			action: 'send',
			guildId,
			target: {
				id: panel.id.toString(),
				name: panel.name,
				type: 'panel',
			},
			userId: req.user.id,
		});

		return {
			success: true,
			messageId: message.id,
			channelId: channel.id,
		};
	},
	onRequest: [fastify.authenticate, fastify.isAdmin],
});

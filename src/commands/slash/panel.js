const { SlashCommand } = require('@eartharoid/dbf');
const {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ButtonBuilder,
	ButtonStyle: {
		Primary,
		Secondary,
	},
	EmbedBuilder,
	PermissionFlagsBits,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} = require('discord.js');
const emoji = require('node-emoji');

module.exports = class PanelSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'panel';
		super(client, {
			...options,
			description: client.i18n.getMessage(null, `commands.slash.${name}.description`),
			descriptionLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.description`),
			dmPermission: false,
			name,
			nameLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.name`),
			options: [
				{
					autocomplete: true,
					name: 'panel',
					required: true,
					type: ApplicationCommandOptionType.Integer,
				},
				{
					name: 'channel',
					required: false,
					type: ApplicationCommandOptionType.Channel,
				},
			].map(option => {
				option.descriptionLocalizations = client.i18n.getAllMessages(`commands.slash.${name}.options.${option.name}.description`);
				option.description = option.descriptionLocalizations['en-GB'];
				option.nameLocalizations = client.i18n.getAllMessages(`commands.slash.${name}.options.${option.name}.name`);
				return option;
			}),
			defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
		});
	}

	/**
	 * @param {import("discord.js").ChatInputCommandInteraction} interaction
	 */
	async run(interaction) {
		await interaction.deferReply({ ephemeral: true });

		const panelId = interaction.options.getInteger('panel', true);
		const targetChannel = interaction.options.getChannel('channel', false) || interaction.channel;

		const panel = await this.client.prisma.panel.findFirst({
			where: {
				id: panelId,
				guildId: interaction.guildId,
			},
			include: {
				guild: {
					select: {
						categories: true,
						errorColour: true,
						footer: true,
						locale: true,
						primaryColour: true,
						successColour: true,
					},
				},
			},
		});

		if (!panel) {
			const settings = await this.client.prisma.guild.findUnique({
				select: { errorColour: true, locale: true },
				where: { id: interaction.guildId },
			});
			const getMessage = this.client.i18n.getLocale(settings.locale);
			return await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(settings.errorColour)
						.setTitle(getMessage('commands.slash.panel.not_found.title'))
						.setDescription(getMessage('commands.slash.panel.not_found.description')),
				],
			});
		}

		const settings = panel.guild;
		const getMessage = this.client.i18n.getLocale(settings.locale);

		const categoryIds = typeof panel.categories === 'string'
			? JSON.parse(panel.categories)
			: panel.categories;

		const categories = categoryIds.map(id => {
			const category = settings.categories.find(c => c.id === id);
			if (!category) throw new Error(`Invalid category: ${id}`);
			return category;
		});

		if (categories.length === 0) {
			return await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(settings.errorColour)
						.setTitle(getMessage('commands.slash.panel.no_categories.title'))
						.setDescription(getMessage('commands.slash.panel.no_categories.description')),
				],
			});
		}

		const embed = new EmbedBuilder()
			.setColor(settings.primaryColour);

		if (settings.footer) {
			embed.setFooter({
				iconURL: interaction.guild.iconURL(),
				text: settings.footer,
			});
		}

		if (panel.title) embed.setTitle(panel.title);
		if (panel.description) embed.setDescription(panel.description);
		if (panel.image) embed.setImage(panel.image);
		if (panel.thumbnail) embed.setThumbnail(panel.thumbnail);

		if (panel.type === 'MESSAGE') {
			const message = await targetChannel.send({ embeds: [embed] });

			await this.client.prisma.panelMessage.create({
				data: {
					panelId: panel.id,
					channelId: targetChannel.id,
					messageId: message.id,
				},
			});
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

			try {
				const message = await targetChannel.send({
					components: [
						new ActionRowBuilder()
							.setComponents(components),
					],
					embeds: [embed],
				});

				await this.client.prisma.panelMessage.create({
					data: {
						panelId: panel.id,
						channelId: targetChannel.id,
						messageId: message.id,
					},
				});
			} catch (error) {
				this.client.log.error.commands(error);
				return await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(settings.errorColour)
							.setTitle(getMessage('commands.slash.panel.send_error.title'))
							.setDescription(getMessage('commands.slash.panel.send_error.description')),
					],
				});
			}
		}

		return await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor(settings.successColour)
					.setTitle(getMessage('commands.slash.panel.success.title'))
					.setDescription(getMessage('commands.slash.panel.success.description', { channel: targetChannel.toString() })),
			],
		});
	}
};

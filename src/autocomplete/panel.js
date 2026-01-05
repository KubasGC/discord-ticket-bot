const { Autocompleter } = require('@eartharoid/dbf');
const ms = require('ms');

module.exports = class PanelCompleter extends Autocompleter {
	constructor(client, options) {
		super(client, {
			...options,
			id: 'panel',
		});
	}

	/**
	 * @param {string} value
	 * @param {*} command
	 * @param {import("discord.js").AutocompleteInteraction} interaction
	 */
	async run(value, command, interaction) {
		/** @type {import("client")} */
		const client = this.client;

		const cacheKey = `cache/guild-panels:${interaction.guild.id}`;
		let panels = await client.keyv.get(cacheKey);
		if (!panels) {
			panels = await client.prisma.panel.findMany({
				select: {
					id: true,
					name: true,
					title: true,
				},
				where: { guildId: interaction.guild.id },
			});
			client.keyv.set(cacheKey, panels, ms('5m'));
		}

		const options = value ? panels.filter(panel =>
			panel.name.match(new RegExp(value, 'i')) ||
			panel.title?.match(new RegExp(value, 'i')) ||
			String(panel.id).includes(value),
		) : panels;

		await interaction.respond(
			options
				.slice(0, 25)
				.map(panel => ({
					name: `#${panel.id} - ${panel.name}${panel.title ? ` (${panel.title})` : ''}`.slice(0, 100),
					value: panel.id,
				})),
		);
	}
};

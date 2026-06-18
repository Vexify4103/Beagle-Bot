import { SlashCommandBuilder, ChannelType, PermissionFlagsBits, MessageFlags, EmbedBuilder, TextChannel } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { readConfig, writeConfig } from '../../utils/storage';
import { sendInitialSticky } from '../../utils/sticky';
import { sanitizeEmbedData } from '../../utils/sticky';
import type { Command } from '../../types';

async function fetchSourceBin(url: string): Promise<string> {
	const match = url.match(/sourceb\.in\/([A-Za-z0-9]+)/);
	if (!match) throw new Error('Invalid sourceb.in URL');
	const binId = match[1];
	const rawUrl = `https://cdn.sourceb.in/bins/${binId}/0`;
	const res = await fetch(rawUrl);
	if (!res.ok) throw new Error(`Failed to fetch sourceb.in: ${res.status}`);
	return await res.text();
}

const command: Command = {
	data: new SlashCommandBuilder()
		.setName('setup-sticky')
		.setDescription('Set up a sticky message in a channel')
		.addChannelOption((option) =>
			option.setName('channel').setDescription('The channel to send the sticky message in').addChannelTypes(ChannelType.GuildText).setRequired(true)
		)
		.addStringOption((option) => option.setName('data').setDescription('Embed JSON or sourceb.in URL').setRequired(true))
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		const channel = interaction.options.getChannel('channel', true);
		const rawInput = interaction.options.getString('data', true);

		let embedJson: string;
		if (rawInput.startsWith('https://sourceb.in/')) {
			try {
				embedJson = await fetchSourceBin(rawInput);
			} catch (err) {
				await interaction.reply({
					content: `Failed to fetch from sourceb.in: ${err instanceof Error ? err.message : 'Unknown error'}`,
					flags: [MessageFlags.Ephemeral],
				});
				return;
			}
		} else {
			embedJson = rawInput;
		}

		let embedData: Record<string, unknown>;
		let messageContent: string | undefined;
		try {
			const parsed = JSON.parse(embedJson) as Record<string, unknown>;
			// Handle full message objects (e.g. { content, embeds, components })
			if (Array.isArray(parsed.embeds) && parsed.embeds.length > 0) {
				embedData = sanitizeEmbedData(parsed.embeds[0] as Record<string, unknown>);
				if (typeof parsed.content === 'string') {
					messageContent = parsed.content;
				}
			} else {
				embedData = sanitizeEmbedData(parsed);
			}
		} catch {
			await interaction.reply({
				content: 'Invalid JSON. Please provide valid embed JSON or a sourceb.in link.',
				flags: [MessageFlags.Ephemeral],
			});
			return;
		}

		try {
			EmbedBuilder.from(embedData);
		} catch {
			await interaction.reply({
				content: 'Invalid embed structure. The JSON must be a valid Discord embed object (e.g. must have at least a title or description).',
				flags: [MessageFlags.Ephemeral],
			});
			return;
		}

		const config = readConfig();
		const previous = config.stickyChannelId;
		config.stickyChannelId = channel.id;
		config.stickyEmbedData = embedData;
		config.stickyContent = messageContent ?? null;
		writeConfig(config);

		const textChannel = interaction.client.channels.cache.get(channel.id);
		if (textChannel instanceof TextChannel) {
			await sendInitialSticky(textChannel);
		}

		const changed = previous && previous !== channel.id ? ` (was <#${previous}>)` : '';
		await interaction.reply({
			content: `Sticky message set to <#${channel.id}>${changed}. It will re-post after 600 seconds of inactivity.`,
			flags: [MessageFlags.Ephemeral],
		});
	},
};

export default command;

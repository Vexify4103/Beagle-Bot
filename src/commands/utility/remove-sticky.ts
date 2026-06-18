import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, TextChannel } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { readConfig, writeConfig } from '../../utils/storage';
import { stopStickyTimer, getLastStickyMessageId } from '../../utils/sticky';
import type { Command } from '../../types';

const command: Command = {
	data: new SlashCommandBuilder()
		.setName('remove-sticky')
		.setDescription('Remove the sticky message from its channel')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		const config = readConfig();
		if (!config.stickyChannelId) {
			await interaction.reply({
				content: 'No sticky message is currently configured.',
				flags: [MessageFlags.Ephemeral],
			});
			return;
		}

		const channelId = config.stickyChannelId;

		// Delete the current sticky message if it exists
		const lastId = getLastStickyMessageId();
		if (lastId) {
			try {
				const channel = await interaction.client.channels.fetch(channelId);
				if (channel instanceof TextChannel) {
					const msg = await channel.messages.fetch(lastId);
					await msg.delete();
				}
			} catch {
				// Message already deleted or channel inaccessible
			}
		}

		stopStickyTimer();

		config.stickyChannelId = null;
		config.stickyEmbedData = null;
		config.stickyContent = null;
		writeConfig(config);

		await interaction.reply({
			content: 'Sticky message removed.',
			flags: [MessageFlags.Ephemeral],
		});
	},
};

export default command;

import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { readConfig, writeConfig } from '../../utils/storage';
import type { Command } from '../../types';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup-queue')
    .setDescription('Designate a voice channel as the stream queue')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('The voice channel to use as the queue')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const channel = interaction.options.getChannel('channel', true);
    const config = readConfig();
    const previous = config.queueChannelId;
    config.queueChannelId = channel.id;
    writeConfig(config);

    const changed = previous && previous !== channel.id ? ` (was <#${previous}>)` : '';
    await interaction.reply({
      content: `Queue channel set to <#${channel.id}>${changed}.\nMembers who join that channel will be automatically numbered in join order.`,
      ephemeral: true,
    });
  },
};

export default command;

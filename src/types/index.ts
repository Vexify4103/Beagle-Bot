import type { Collection, SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export interface BotClient extends Client {
  commands: Collection<string, Command>;
}

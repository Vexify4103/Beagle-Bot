import type { Collection, SharedSlashCommand, ChatInputCommandInteraction, Client } from 'discord.js';

export interface Command {
	data: SharedSlashCommand;
	execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export interface BotClient extends Client {
	commands: Collection<string, Command>;
}

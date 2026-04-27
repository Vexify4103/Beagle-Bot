import { Events, MessageFlags } from 'discord.js';
import type { Interaction } from 'discord.js';
import type { BotClient } from '../types';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: Interaction): Promise<void> {
	if (!interaction.isChatInputCommand()) return;

	const client = interaction.client as BotClient;
	const command = client.commands.get(interaction.commandName);
	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(`Error in /${interaction.commandName}:`, error);
		const msg = { content: 'Something went wrong running that command.', flags: MessageFlags.Ephemeral as number };
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp(msg);
		} else {
			await interaction.reply(msg);
		}
	}
}

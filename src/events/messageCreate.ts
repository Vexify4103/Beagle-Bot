import { Events } from 'discord.js';
import type { Message } from 'discord.js';
import { readConfig } from '../utils/storage';
import { resetStickyTimer } from '../utils/sticky';

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message): Promise<void> {
	if (message.author.bot) return;

	const config = readConfig();
	if (!config.stickyChannelId) return;
	if (message.channel.id !== config.stickyChannelId) return;

	resetStickyTimer(message.client);
}

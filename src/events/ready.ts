import { ActivityType, Events, VoiceChannel } from 'discord.js';
import type { Client } from 'discord.js';
import { readConfig } from '../utils/storage';
import * as queue from '../utils/queue';
import { deployCommands } from '../utils/deployCommands';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client<true>): Promise<void> {
	console.log(`Ready! Logged in as ${client.user.tag}`);
	await deployCommands();

	client.user.setPresence({
		status: 'online',
		activities: [{ name: 'twitch.tv/mcdev_tv', type: ActivityType.Watching }],
	});

	const { queueChannelId } = readConfig();
	if (!queueChannelId) return;

	const channel = await client.channels.fetch(queueChannelId).catch(() => null);
	if (!(channel instanceof VoiceChannel) || channel.members.size === 0) return;

	// Re-populate queue from whoever is already in the channel.
	// Join order among pre-existing members is unknown after a restart,
	// so they're added in the order Discord returns them (roughly join order).
	for (const [, member] of channel.members) {
		queue.add(member);
	}

	await queue.refreshNicknames(channel);
	console.log(`Restored queue for ${queue.size()} member(s) in #${channel.name}`);
}

import { EmbedBuilder, TextChannel } from 'discord.js';
import type { Client } from 'discord.js';
import { readConfig } from './storage';

const STICKY_TIMEOUT_MS = 600_000; // 600 seconds

let stickyTimer: ReturnType<typeof setTimeout> | null = null;
let lastStickyMessageId: string | null = null;

export function sanitizeEmbedData(data: Record<string, unknown>): Record<string, unknown> {
	const clean: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(data)) {
		if (value === null || value === undefined) continue;
		if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
			clean[key] = sanitizeEmbedData(value as Record<string, unknown>);
		} else if (Array.isArray(value)) {
			clean[key] = value.map((item) => (typeof item === 'object' && item !== null && !Array.isArray(item) ? sanitizeEmbedData(item as Record<string, unknown>) : item));
		} else {
			clean[key] = value;
		}
	}
	return clean;
}

function buildEmbed(embedData: Record<string, unknown>): EmbedBuilder {
	const sanitized = sanitizeEmbedData(embedData);
	const embed = EmbedBuilder.from(sanitized);
	return embed;
}

async function deleteLastSticky(channel: TextChannel): Promise<void> {
	// Try in-memory ID first
	if (lastStickyMessageId) {
		try {
			const msg = await channel.messages.fetch(lastStickyMessageId);
			await msg.delete();
		} catch {
			// Already deleted
		}
		lastStickyMessageId = null;
		return;
	}

	// Fallback: find the bot's last message in the channel (e.g. after restart)
	try {
		const messages = await channel.messages.fetch({ limit: 20 });
		const botMessage = messages.find((m) => m.author.bot);
		if (botMessage) {
			await botMessage.delete();
		}
	} catch {
		// Channel inaccessible or no messages
	}
}

async function sendSticky(channel: TextChannel): Promise<void> {
	const config = readConfig();
	if (!config.stickyChannelId || !config.stickyEmbedData) return;
	if (channel.id !== config.stickyChannelId) return;

	const embed = buildEmbed(config.stickyEmbedData);
	const payload: { content?: string; embeds: EmbedBuilder[] } = { embeds: [embed] };
	if (config.stickyContent) {
		payload.content = config.stickyContent;
	}
	const msg = await channel.send(payload);
	lastStickyMessageId = msg.id;
}

function fireSticky(client: Client): void {
	const config = readConfig();
	if (!config.stickyChannelId) return;

	stickyTimer = null;

	client.channels
		.fetch(config.stickyChannelId)
		.then((ch) => {
			if (!(ch instanceof TextChannel)) return;
			return deleteLastSticky(ch).then(() => sendSticky(ch));
		})
		.catch(() => null);
}

export function startStickyTimer(client: Client): void {
	stopStickyTimer();
	stickyTimer = setTimeout(() => fireSticky(client), STICKY_TIMEOUT_MS);
}

export function resetStickyTimer(client: Client): void {
	startStickyTimer(client);
}

export function stopStickyTimer(): void {
	if (stickyTimer) {
		clearTimeout(stickyTimer);
		stickyTimer = null;
	}
	lastStickyMessageId = null;
}

export async function sendInitialSticky(channel: TextChannel): Promise<void> {
	await deleteLastSticky(channel);
	await sendSticky(channel);
}

export function getLastStickyMessageId(): string | null {
	return lastStickyMessageId;
}

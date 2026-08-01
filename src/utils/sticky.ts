import { ContainerBuilder, MediaGalleryBuilder, MessageFlags, SeparatorBuilder, TextDisplayBuilder, TextChannel } from 'discord.js';
import type { Client, MessageCreateOptions } from 'discord.js';
import { readConfig } from './storage';

export const STICKY_TIMEOUT_MS = 600_000; // 600 seconds
export const STICKY_MESSAGE_THRESHOLD = 100;

let stickyTimer: ReturnType<typeof setTimeout> | null = null;
let lastStickyMessageId: string | null = null;
let messagesSinceLastSticky = 0;
let stickyRefreshInProgress = false;

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

function getString(value: unknown): string | null {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function addSeparatedText(container: ContainerBuilder, content: string): void {
	if (container.components.length > 0) {
		container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
	}
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
}

function splitStickyContent(content: string | null): { pinContent: string | null; containerContent: string | null } {
	if (!content) return { pinContent: null, containerContent: null };

	const paragraphs = content
		.trim()
		.split(/\r?\n\s*\r?\n/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);

	return {
		pinContent: paragraphs.shift() ?? null,
		containerContent: paragraphs.length > 0 ? paragraphs.join('\n\n') : null,
	};
}

export function buildStickyComponents(embedData: Record<string, unknown>, content: string | null): (TextDisplayBuilder | ContainerBuilder)[] {
	const clean = sanitizeEmbedData(embedData);
	const container = new ContainerBuilder();
	const { pinContent, containerContent } = splitStickyContent(content);
	const components: (TextDisplayBuilder | ContainerBuilder)[] = [];

	if (pinContent) {
		components.push(new TextDisplayBuilder().setContent(pinContent));
	}

	if (typeof clean.color === 'number') {
		container.setAccentColor(clean.color);
	}

	const author = getRecord(clean.author);
	const authorName = getString(author?.name);
	const title = getString(clean.title);
	const titleUrl = getString(clean.url);
	const description = getString(clean.description);
	const heading: string[] = [];

	if (authorName) heading.push(`-# ${authorName}`);
	if (title) heading.push(`## ${titleUrl ? `[${title}](${titleUrl})` : title}`);
	if (description) heading.push(description);
	if (heading.length > 0) {
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(heading.join('\n')));
	}

	if (containerContent) {
		addSeparatedText(container, containerContent);
	}

	if (Array.isArray(clean.fields)) {
		for (const field of clean.fields) {
			const fieldData = getRecord(field);
			const name = getString(fieldData?.name);
			const value = getString(fieldData?.value);
			if (name && value) {
				addSeparatedText(container, `### ${name}\n${value}`);
			}
		}
	}

	const mediaUrls = [getString(getRecord(clean.thumbnail)?.url), getString(getRecord(clean.image)?.url)].filter((url): url is string => url !== null);
	if (mediaUrls.length > 0) {
		if (container.components.length > 0) {
			container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
		}
		const gallery = new MediaGalleryBuilder();
		for (const url of mediaUrls) {
			gallery.addItems((item) => item.setURL(url));
		}
		container.addMediaGalleryComponents(gallery);
	}

	const footer = getRecord(clean.footer);
	const footerText = getString(footer?.text);
	if (footerText) {
		addSeparatedText(container, `-# ${footerText}`);
	}

	if (container.components.length > 0) {
		components.push(container);
	}

	return components;
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

async function sendSticky(channel: TextChannel): Promise<boolean> {
	const config = readConfig();
	if (!config.stickyChannelId || !config.stickyEmbedData) return false;
	if (channel.id !== config.stickyChannelId) return false;

	const components = buildStickyComponents(config.stickyEmbedData, config.stickyContent);
	if (components.length === 0) return false;

	const payload: MessageCreateOptions = {
		components,
		flags: MessageFlags.IsComponentsV2,
		// Text displays can create mentions, unlike embed text. Keep the old no-ping behavior.
		allowedMentions: { parse: [] },
	};
	const msg = await channel.send(payload);
	lastStickyMessageId = msg.id;
	return true;
}

async function refreshSticky(client: Client): Promise<void> {
	if (stickyRefreshInProgress) return;

	const config = readConfig();
	if (!config.stickyChannelId) return;

	stickyRefreshInProgress = true;
	const messageCountAtRefreshStart = messagesSinceLastSticky;
	let refreshed = false;

	try {
		const channel = await client.channels.fetch(config.stickyChannelId);
		if (!(channel instanceof TextChannel)) return;

		await deleteLastSticky(channel);
		refreshed = await sendSticky(channel);
		// Keep messages received while the sticky was being replaced so none are lost.
		if (refreshed) {
			messagesSinceLastSticky = Math.max(0, messagesSinceLastSticky - messageCountAtRefreshStart);
		}
	} catch {
		// Channel inaccessible or message permissions unavailable.
	} finally {
		stickyRefreshInProgress = false;
		if (refreshed && messagesSinceLastSticky >= STICKY_MESSAGE_THRESHOLD) {
			void refreshSticky(client);
		}
	}
}

export function startStickyTimer(client: Client): void {
	if (stickyTimer) clearTimeout(stickyTimer);
	stickyTimer = setTimeout(() => {
		stickyTimer = null;
		void refreshSticky(client);
	}, STICKY_TIMEOUT_MS);
}

export function resetStickyTimer(client: Client): void {
	startStickyTimer(client);
}

export function recordStickyMessage(client: Client): void {
	messagesSinceLastSticky += 1;

	if (messagesSinceLastSticky >= STICKY_MESSAGE_THRESHOLD) {
		if (stickyTimer) {
			clearTimeout(stickyTimer);
			stickyTimer = null;
		}
		void refreshSticky(client);
		return;
	}

	resetStickyTimer(client);
}

export function stopStickyTimer(): void {
	if (stickyTimer) {
		clearTimeout(stickyTimer);
		stickyTimer = null;
	}
	lastStickyMessageId = null;
	messagesSinceLastSticky = 0;
}

export async function sendInitialSticky(channel: TextChannel): Promise<void> {
	await deleteLastSticky(channel);
	await sendSticky(channel);
	messagesSinceLastSticky = 0;
}

export function getLastStickyMessageId(): string | null {
	return lastStickyMessageId;
}

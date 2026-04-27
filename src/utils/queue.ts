import type { GuildMember, VoiceChannel } from 'discord.js';

interface QueueEntry {
	userId: string;
	originalNick: string | null;
	joinedAt: number;
}

const entries = new Map<string, QueueEntry>();

export function add(member: GuildMember): void {
	if (entries.has(member.id)) return;
	entries.set(member.id, {
		userId: member.id,
		originalNick: member.nickname,
		joinedAt: Date.now(),
	});
}

/** Removes member from queue and returns their original nickname to restore. */
export function remove(userId: string): string | null | undefined {
	const entry = entries.get(userId);
	if (!entry) return undefined;
	entries.delete(userId);
	return entry.originalNick;
}

export function has(userId: string): boolean {
	return entries.has(userId);
}

export function size(): number {
	return entries.size;
}

export function sorted(): QueueEntry[] {
	return [...entries.values()].sort((a, b) => a.joinedAt - b.joinedAt);
}

/**
 * Renames all members in the channel to reflect their current queue position.
 * Format: "#1 | OriginalName" (max 32 chars, Discord's nickname limit).
 */
export async function refreshNicknames(channel: VoiceChannel): Promise<void> {
	const order = sorted();
	await Promise.all(
		order.map(async (entry, i) => {
			const member = channel.members.get(entry.userId);
			if (!member) return;
			const base = entry.originalNick ?? member.user.displayName;
			const nick = `#${i + 1} | ${base}`.slice(0, 32);
			if (member.nickname !== nick) {
				await member.setNickname(nick, `Queue position updated to #${i + 1}`).catch(() => null);
			}
		})
	);
}

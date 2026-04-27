import { Events, VoiceChannel } from 'discord.js';
import type { VoiceState } from 'discord.js';
import { readConfig } from '../utils/storage';
import * as queue from '../utils/queue';

export const name = Events.VoiceStateUpdate;
export const once = false;

export async function execute(oldState: VoiceState, newState: VoiceState): Promise<void> {
  const { queueChannelId } = readConfig();
  if (!queueChannelId) return;

  const leftQueue =
    oldState.channelId === queueChannelId && newState.channelId !== queueChannelId;
  const joinedQueue =
    newState.channelId === queueChannelId && oldState.channelId !== queueChannelId;

  if (leftQueue) {
    const member = oldState.member;
    if (!member) return;

    const originalNick = queue.remove(member.id);
    if (originalNick !== undefined) {
      // null = had no custom nickname, restores to username
      await member.setNickname(originalNick).catch(() => null);
    }

    const channel = oldState.guild.channels.cache.get(queueChannelId);
    if (channel instanceof VoiceChannel) {
      await queue.refreshNicknames(channel);
    }
  }

  if (joinedQueue) {
    const member = newState.member;
    if (!member) return;

    queue.add(member);

    const channel = newState.guild.channels.cache.get(queueChannelId);
    if (channel instanceof VoiceChannel) {
      await queue.refreshNicknames(channel);
    }
  }
}

import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import type { Command } from '../types';

export async function deployCommands(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId || !guildId) {
    console.warn('[deploy] Skipping command deploy — missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID');
    return;
  }

  const commands: ReturnType<SlashCommandBuilder['toJSON']>[] = [];
  const ext = __filename.endsWith('.ts') ? '.ts' : '.js';
  const commandsPath = path.join(__dirname, '../commands');

  for (const folder of fs.readdirSync(commandsPath)) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;
    for (const file of fs.readdirSync(folderPath).filter(f => f.endsWith(ext))) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const command = (require(path.join(folderPath, file)) as { default: Command }).default;
      commands.push((command.data as SlashCommandBuilder).toJSON());
    }
  }

  const rest = new REST().setToken(token);
  const data = (await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands,
  })) as unknown[];

  console.log(`[deploy] Registered ${data.length} command(s) to guild ${guildId}`);
}

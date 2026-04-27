import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import type { Command } from './types';

const commands: ReturnType<SlashCommandBuilder['toJSON']>[] = [];

const ext = __filename.endsWith('.ts') ? '.ts' : '.js';
const commandsPath = path.join(__dirname, 'commands');

for (const folder of fs.readdirSync(commandsPath)) {
  const folderPath = path.join(commandsPath, folder);
  if (!fs.statSync(folderPath).isDirectory()) continue;
  for (const file of fs.readdirSync(folderPath).filter(f => f.endsWith(ext))) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const command = (require(path.join(folderPath, file)) as { default: Command }).default;
    commands.push((command.data as SlashCommandBuilder).toJSON());
  }
}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error('Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in .env');
  process.exit(1);
}

const rest = new REST().setToken(token);

(async () => {
  console.log(`Deploying ${commands.length} command(s) to guild ${guildId}...`);
  const data = (await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands,
  })) as unknown[];
  console.log(`Successfully registered ${data.length} command(s).`);
})();

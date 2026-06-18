import 'dotenv/config';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import type { BotClient, Command } from './types';

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
}) as BotClient;

client.commands = new Collection();

const ext = __filename.endsWith('.ts') ? '.ts' : '.js';

// Load all commands from subfolders of src/commands/
const commandsPath = path.join(__dirname, 'commands');
for (const folder of fs.readdirSync(commandsPath)) {
	const folderPath = path.join(commandsPath, folder);
	if (!fs.statSync(folderPath).isDirectory()) continue;
	for (const file of fs.readdirSync(folderPath).filter((f) => f.endsWith(ext))) {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const command = (require(path.join(folderPath, file)) as { default: Command }).default;
		client.commands.set(command.data.name, command);
	}
}

// Load all events from src/events/
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter((f) => f.endsWith(ext))) {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const event = require(path.join(eventsPath, file)) as {
		name: string;
		once: boolean;
		execute: (...args: unknown[]) => Promise<void>;
	};
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

client.login(process.env.DISCORD_TOKEN);

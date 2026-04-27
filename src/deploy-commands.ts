import 'dotenv/config';
import { deployCommands } from './utils/deployCommands';

deployCommands().catch(console.error);

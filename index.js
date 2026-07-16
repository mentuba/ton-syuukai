require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');
const { startKeepAliveServer } = require('./utils/keepAlive');

const { TOKEN } = process.env;

if (!TOKEN) {
  console.error('TOKEN を環境変数（.env）に設定してください。');
  process.exit(1);
}

// Koyeb等の無料ホスティングでスリープさせずに常時起動したい場合に使用します。
// ローカル開発時など不要な場合は KEEP_ALIVE=false を設定してください。
if (process.env.KEEP_ALIVE !== 'false') {
  startKeepAliveServer();
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const commandsDir = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsDir, file));
  client.commands.set(command.data.name, command);
}

client.once('ready', () => {
  console.log(`ログインしました: ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    if (interaction.isChatInputCommand()) {
      await command.execute(interaction);
    } else if (interaction.isAutocomplete()) {
      if (command.autocomplete) {
        await command.autocomplete(interaction);
      }
    }
  } catch (error) {
    console.error(error);
    if (interaction.isChatInputCommand()) {
      const payload = {
        content: 'コマンドの実行中にエラーが発生しました。',
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  }
});

client.login(TOKEN);

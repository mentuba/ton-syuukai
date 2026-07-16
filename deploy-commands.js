require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const { TOKEN, APPLICATION_ID, GUILD_ID } = process.env;

if (!TOKEN || !APPLICATION_ID) {
  console.error('TOKEN と APPLICATION_ID を環境変数（.env）に設定してください。');
  process.exit(1);
}

const commandsDir = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'));

const commandsJSON = commandFiles.map((file) => {
  const command = require(path.join(commandsDir, file));
  return command.data.toJSON();
});

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    const route = GUILD_ID
      ? Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID)
      : Routes.applicationCommands(APPLICATION_ID);

    console.log(`${commandsJSON.length} 件のコマンドを登録します...`);
    await rest.put(route, { body: commandsJSON });
    console.log('コマンドの登録が完了しました。');
    if (!GUILD_ID) {
      console.log('グローバルコマンドとして登録したため、反映まで最大1時間ほどかかる場合があります。');
    }
  } catch (error) {
    console.error(error);
  }
})();

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { loadSubmissions, saveSubmissions, todayString } = require('../utils/dataStore');
const { isAdmin } = require('../utils/permissions');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const data = new SlashCommandBuilder()
  .setName('session')
  .setDescription('開催セッションの管理（管理者のみ）')
  .addSubcommand((sub) =>
    sub
      .setName('create')
      .setDescription('新しいセッションを作成する')
      .addStringOption((opt) =>
        opt
          .setName('date')
          .setDescription('開催日（YYYY-MM-DD）。省略時は本日の日付を使用します')
          .setRequired(false)
      )
  )
  .addSubcommand((sub) => sub.setName('close').setDescription('現在のセッションを終了する'));

function emptySession() {
  return { closed: false, cracked: {}, ghost: {}, alternate: {} };
}

async function execute(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: 'このコマンドは管理者のみ実行できます。',
      flags: MessageFlags.Ephemeral,
    });
  }

  const sub = interaction.options.getSubcommand();
  const data = loadSubmissions();

  if (sub === 'create') {
    let date = interaction.options.getString('date');
    if (date) {
      if (!DATE_REGEX.test(date)) {
        return interaction.reply({
          content: '日付は YYYY-MM-DD 形式で指定してください。',
          flags: MessageFlags.Ephemeral,
        });
      }
    } else {
      date = todayString();
    }

    if (data.sessions[date]) {
      return interaction.reply({
        content: `${date} のセッションは既に存在するため作成しませんでした。`,
        flags: MessageFlags.Ephemeral,
      });
    }

    data.sessions[date] = emptySession();
    data.currentSession = date;
    saveSubmissions(data);

    return interaction.reply({
      content: `${date} のセッションを作成しました。提出受付を開始します。`,
    });
  }

  if (sub === 'close') {
    const currentDate = data.currentSession;
    const session = currentDate ? data.sessions[currentDate] : null;

    if (!currentDate || !session || session.closed) {
      return interaction.reply({
        content: '現在開催中のセッションがありません。',
        flags: MessageFlags.Ephemeral,
      });
    }

    session.closed = true;
    data.currentSession = null;
    saveSubmissions(data);

    return interaction.reply({
      content: `${currentDate} のセッションを終了しました。提出受付を締め切ります。`,
    });
  }
}

module.exports = { data, execute };

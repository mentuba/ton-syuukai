const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const {
  loadSubmissions,
  saveSubmissions,
  getActiveSession,
  getSessionByDate,
  listSessionDates,
  CATEGORIES,
} = require('../utils/dataStore');
const { isAdmin } = require('../utils/permissions');

const CATEGORY_CHOICES = [
  { name: 'Cracked', value: 'cracked' },
  { name: 'Ghost', value: 'ghost' },
  { name: 'Alternate', value: 'alternate' },
  { name: 'すべて', value: 'all' },
];

const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('提出データをクリアする（管理者のみ）')
  .addStringOption((opt) =>
    opt
      .setName('category')
      .setDescription('クリア対象のカテゴリ')
      .setRequired(true)
      .addChoices(...CATEGORY_CHOICES)
  )
  .addUserOption((opt) =>
    opt
      .setName('user')
      .setDescription('特定ユーザーの提出のみクリアする場合に指定')
      .setRequired(false)
  )
  .addStringOption((opt) =>
    opt
      .setName('date')
      .setDescription('対象の開催日（省略時は現在受付中のセッション）')
      .setRequired(false)
      .setAutocomplete(true)
  );

async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toString();
  const data = loadSubmissions();
  const dates = listSessionDates(data).filter((d) => d.includes(focused)).slice(0, 25);
  await interaction.respond(dates.map((d) => ({ name: d, value: d })));
}

function resolveCategoryKeys(category) {
  return category === 'all' ? ['cracked', 'ghost', 'alternate'] : [category];
}

async function execute(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: 'このコマンドは管理者のみ実行できます。',
      flags: MessageFlags.Ephemeral,
    });
  }

  const category = interaction.options.getString('category', true);
  const targetUser = interaction.options.getUser('user');
  const dateOption = interaction.options.getString('date');

  const data = loadSubmissions();
  let target;
  if (dateOption) {
    target = getSessionByDate(data, dateOption);
    if (!target) {
      return interaction.reply({
        content: `${dateOption} のセッションが見つかりません。`,
        flags: MessageFlags.Ephemeral,
      });
    }
  } else {
    target = getActiveSession(data);
    if (!target) {
      return interaction.reply({
        content: '現在開催中のセッションがありません。date を指定してください。',
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  const { date, session } = target;
  const categoryKeys = resolveCategoryKeys(category);

  let clearedCount = 0;
  for (const catKey of categoryKeys) {
    const bucket = session[catKey] || {};
    if (targetUser) {
      if (bucket[targetUser.id]) {
        clearedCount += bucket[targetUser.id].terrors.length;
        delete bucket[targetUser.id];
      }
    } else {
      for (const entry of Object.values(bucket)) {
        clearedCount += entry.terrors.length;
      }
      session[catKey] = {};
    }
  }

  saveSubmissions(data);

  const categoryLabel =
    category === 'all' ? 'すべてのカテゴリ' : CATEGORIES[category]?.label ?? category;
  const targetLabel = targetUser ? `${targetUser.username} さんの` : '';

  return interaction.reply({
    content: `${date} の ${categoryLabel} における${targetLabel}提出データをクリアしました。（${clearedCount}件）`,
  });
}

module.exports = { data, autocomplete, execute };

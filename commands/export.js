const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const {
  loadSubmissions,
  getActiveSession,
  getSessionByDate,
  listSessionDates,
  CATEGORIES,
} = require('../utils/dataStore');
const { isAdmin } = require('../utils/permissions');
const { buildRecords, toCSV, toJSON } = require('../utils/exportUtil');

const CATEGORY_CHOICES = [
  { name: 'Cracked', value: 'cracked' },
  { name: 'Ghost', value: 'ghost' },
  { name: 'Alternate', value: 'alternate' },
  { name: 'すべて', value: 'all' },
];

const FORMAT_CHOICES = [
  { name: 'CSV', value: 'csv' },
  { name: 'JSON', value: 'json' },
];

const data = new SlashCommandBuilder()
  .setName('export')
  .setDescription('提出データをCSV/JSONで出力する（管理者のみ）')
  .addStringOption((opt) =>
    opt
      .setName('category')
      .setDescription('出力対象のカテゴリ')
      .setRequired(true)
      .addChoices(...CATEGORY_CHOICES)
  )
  .addStringOption((opt) =>
    opt
      .setName('format')
      .setDescription('出力形式')
      .setRequired(true)
      .addChoices(...FORMAT_CHOICES)
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
  const format = interaction.options.getString('format', true);
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
  const records = buildRecords(date, session, categoryKeys);

  if (records.length === 0) {
    return interaction.reply({
      content: `${date} には出力可能な提出データがありません。`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const categorySlug = category === 'all' ? 'all' : category;
  const content = format === 'csv' ? toCSV(records) : toJSON(records);
  const extension = format === 'csv' ? 'csv' : 'json';
  const filename = `${date}_${categorySlug}.${extension}`;

  const attachment = new AttachmentBuilder(Buffer.from(content, 'utf8'), { name: filename });

  return interaction.reply({
    content: `${date} の提出データを出力しました。（${records.length}件）`,
    files: [attachment],
  });
}

module.exports = { data, autocomplete, execute };

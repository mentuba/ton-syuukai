const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { loadSubmissions, listSessionDates, getSessionByDate, CATEGORIES } = require('../utils/dataStore');
const { isAdmin } = require('../utils/permissions');

const CATEGORY_CHOICES = [
  { name: 'Cracked', value: 'cracked' },
  { name: 'Ghost', value: 'ghost' },
  { name: 'Alternate', value: 'alternate' },
];

const data = new SlashCommandBuilder()
  .setName('history')
  .setDescription('過去の開催セッションを閲覧する')
  .addSubcommand((sub) => sub.setName('list').setDescription('過去の開催日一覧を表示する'))
  .addSubcommand((sub) =>
    sub
      .setName('view')
      .setDescription('指定した開催日の集計を表示する（管理者のみ）')
      .addStringOption((opt) =>
        opt
          .setName('date')
          .setDescription('開催日')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('category')
          .setDescription('カテゴリ')
          .setRequired(true)
          .addChoices(...CATEGORY_CHOICES)
      )
  );

async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toString();
  const data = loadSubmissions();
  const dates = listSessionDates(data).filter((d) => d.includes(focused)).slice(0, 25);
  await interaction.respond(dates.map((d) => ({ name: d, value: d })));
}

async function handleList(interaction) {
  const data = loadSubmissions();
  const dates = listSessionDates(data);

  if (dates.length === 0) {
    return interaction.reply({
      content: 'セッションの記録がありません。',
      flags: MessageFlags.Ephemeral,
    });
  }

  const lines = dates.map((d) => {
    const s = data.sessions[d];
    const status = s.closed ? '終了' : d === data.currentSession ? '受付中' : '未終了';
    return `・${d}（${status}）`;
  });

  const embed = new EmbedBuilder()
    .setTitle('開催セッション一覧')
    .setDescription(lines.join('\n'))
    .setColor(0x5865f2);

  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleView(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: 'このコマンドは管理者のみ実行できます。',
      flags: MessageFlags.Ephemeral,
    });
  }

  const date = interaction.options.getString('date', true);
  const category = interaction.options.getString('category', true);

  const data = loadSubmissions();
  const target = getSessionByDate(data, date);
  if (!target) {
    return interaction.reply({
      content: `${date} のセッションが見つかりません。`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const categoryLabel = CATEGORIES[category]?.label ?? category;
  const bucket = target.session[category] || {};
  const entries = Object.values(bucket).filter((e) => e.terrors.length > 0);

  if (entries.length === 0) {
    return interaction.reply({
      content: `${date} の ${categoryLabel} には提出データがありません。`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const perTerror = new Map();
  for (const entry of entries) {
    for (const terror of entry.terrors) {
      if (!perTerror.has(terror)) perTerror.set(terror, []);
      perTerror.get(terror).push(entry.displayName);
    }
  }

  const sortedTerrors = [...perTerror.entries()].sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    return a[0].localeCompare(b[0], 'ja');
  });

  const totalSubmitters = entries.length;
  const totalSubmissions = sortedTerrors.reduce((sum, [, names]) => sum + names.length, 0);

  const descriptionParts = sortedTerrors.map(([terror, names]) => {
    const bullets = names.map((n) => `・${n}`).join('\n');
    return `**${terror} ×${names.length}**\n${bullets}`;
  });

  let description = descriptionParts.join('\n\n');
  if (description.length > 3900) {
    description = `${description.slice(0, 3900)}\n…（表示しきれませんでした）`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${categoryLabel} 集計 - ${date}（過去セッション）`)
    .setDescription(description)
    .addFields(
      { name: '提出人数', value: `${totalSubmitters}`, inline: true },
      { name: '提出件数', value: `${totalSubmissions}`, inline: true }
    )
    .setColor(0x5865f2);

  return interaction.reply({ embeds: [embed] });
}

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'list') return handleList(interaction);
  if (sub === 'view') return handleView(interaction);
}

module.exports = { data, autocomplete, execute };

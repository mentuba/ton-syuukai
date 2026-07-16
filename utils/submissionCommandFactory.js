const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const {
  loadSubmissions,
  saveSubmissions,
  loadTerrorList,
  getActiveSession,
  ensureCategoryBucket,
} = require('./dataStore');
const { isAdmin } = require('./permissions');

const NO_SESSION_MSG = '現在開催中のセッションがありません。';

function buildSubmissionCommand(categoryKey, categoryLabel) {
  const data = new SlashCommandBuilder()
    .setName(categoryKey)
    .setDescription(`${categoryLabel} の提出管理`)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription(`${categoryLabel} のテラーを提出する`)
        .addStringOption((opt) =>
          opt
            .setName('terror')
            .setDescription('提出するテラー名')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription(`${categoryLabel} の提出を取り消す`)
        .addStringOption((opt) =>
          opt
            .setName('terror')
            .setDescription('取り消すテラー名')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('自分の提出一覧を表示する（本人のみ表示）')
    )
    .addSubcommand((sub) =>
      sub.setName('check').setDescription('集計結果を表示する（管理者のみ）')
    );

  async function autocomplete(interaction) {
    const focused = interaction.options.getFocused().toString().toLowerCase();
    const terrorList = loadTerrorList(categoryKey);
    const filtered = terrorList
      .filter((t) => t.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((t) => ({ name: t, value: t }));
    await interaction.respond(filtered);
  }

  async function execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') return handleAdd(interaction);
    if (sub === 'remove') return handleRemove(interaction);
    if (sub === 'list') return handleList(interaction);
    if (sub === 'check') return handleCheck(interaction);
  }

  async function handleAdd(interaction) {
    const terror = interaction.options.getString('terror', true);
    const validList = loadTerrorList(categoryKey);
    if (!validList.includes(terror)) {
      return interaction.reply({
        content: `「${terror}」は存在しないテラー名です。候補から選択してください。`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const data = loadSubmissions();
    const active = getActiveSession(data);
    if (!active) {
      return interaction.reply({ content: NO_SESSION_MSG, flags: MessageFlags.Ephemeral });
    }

    const bucket = ensureCategoryBucket(active.session, categoryKey);
    const userId = interaction.user.id;
    const displayName = interaction.member?.displayName ?? interaction.user.username;

    if (!bucket[userId]) {
      bucket[userId] = { displayName, terrors: [] };
    }
    bucket[userId].displayName = displayName; // 表示名は常に最新化

    if (bucket[userId].terrors.includes(terror)) {
      return interaction.reply({
        content: `${terror} は既に提出済みです。`,
        flags: MessageFlags.Ephemeral,
      });
    }

    bucket[userId].terrors.push(terror);
    saveSubmissions(data);

    return interaction.reply({
      content: `${terror} を提出しました。（${active.date}）`,
      flags: MessageFlags.Ephemeral,
    });
  }

  async function handleRemove(interaction) {
    const terror = interaction.options.getString('terror', true);

    const data = loadSubmissions();
    const active = getActiveSession(data);
    if (!active) {
      return interaction.reply({ content: NO_SESSION_MSG, flags: MessageFlags.Ephemeral });
    }

    const bucket = ensureCategoryBucket(active.session, categoryKey);
    const userId = interaction.user.id;
    const entry = bucket[userId];

    if (!entry || !entry.terrors.includes(terror)) {
      return interaction.reply({
        content: `${terror} は提出されていません。`,
        flags: MessageFlags.Ephemeral,
      });
    }

    entry.terrors = entry.terrors.filter((t) => t !== terror);
    saveSubmissions(data);

    return interaction.reply({
      content: `${terror} の提出を取り消しました。`,
      flags: MessageFlags.Ephemeral,
    });
  }

  async function handleList(interaction) {
    const data = loadSubmissions();
    const active = getActiveSession(data);
    if (!active) {
      return interaction.reply({ content: NO_SESSION_MSG, flags: MessageFlags.Ephemeral });
    }

    const bucket = ensureCategoryBucket(active.session, categoryKey);
    const entry = bucket[interaction.user.id];

    if (!entry || entry.terrors.length === 0) {
      return interaction.reply({
        content: `現在の提出はありません。（${active.date} / ${categoryLabel}）`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const lines = entry.terrors.map((t) => `・${t}`).join('\n');
    return interaction.reply({
      content: `**${active.date} / ${categoryLabel} 提出一覧**\n${lines}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  async function handleCheck(interaction) {
    if (!isAdmin(interaction)) {
      return interaction.reply({
        content: 'このコマンドは管理者のみ実行できます。',
        flags: MessageFlags.Ephemeral,
      });
    }

    const data = loadSubmissions();
    const active = getActiveSession(data);
    if (!active) {
      return interaction.reply({ content: NO_SESSION_MSG, flags: MessageFlags.Ephemeral });
    }

    const bucket = ensureCategoryBucket(active.session, categoryKey);
    const entries = Object.values(bucket).filter((e) => e.terrors.length > 0);

    if (entries.length === 0) {
      return interaction.reply({
        content: `現在、${categoryLabel} の提出はありません。（${active.date}）`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // テラー名ごとに提出者をまとめる
    const perTerror = new Map(); // terror -> [displayName, ...]
    for (const entry of entries) {
      for (const terror of entry.terrors) {
        if (!perTerror.has(terror)) perTerror.set(terror, []);
        perTerror.get(terror).push(entry.displayName);
      }
    }

    // 提出数が多い順、同数ならテラー名順
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
      .setTitle(`${categoryLabel} 集計 - ${active.date}`)
      .setDescription(description)
      .addFields(
        { name: '提出人数', value: `${totalSubmitters}`, inline: true },
        { name: '提出件数', value: `${totalSubmissions}`, inline: true }
      )
      .setColor(0x5865f2);

    return interaction.reply({ embeds: [embed] });
  }

  return { data, autocomplete, execute };
}

module.exports = { buildSubmissionCommand };

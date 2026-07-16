const { PermissionFlagsBits } = require('discord.js');

// 管理者コマンド（/session create, /session close, /cracked check 等）に必要な権限。
// サーバー管理権限（ManageGuild）を持つユーザーを管理者として扱います。
// より厳密にしたい場合は PermissionFlagsBits.Administrator に変更してください。
function isAdmin(interaction) {
  if (!interaction.inGuild()) return false;
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

module.exports = { isAdmin };

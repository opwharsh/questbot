let statuses = [
  "ᴋᴇᴇᴘ ꜰᴀʟʟɪɴɢ ɪɴ ʟᴏᴠᴇ ᴡɪᴛʜ ʟᴀɴᴀ ᴅᴇʟ ʀᴇʏ",
  "ᴍᴏɢɢɪɴɢ ɪꜱ ᴀ ꜱɪᴅᴇ ʜᴜꜱᴛʟᴇ ꜰᴏʀ ᴊᴏʀᴅᴀɴ ʙᴀʀʀᴇᴛᴛ",
  "ᴢᴀʏɴ ᴍᴀʟɪᴋ ɪꜱ ᴛʜᴇ ɢᴏᴀᴛ",
  "ᴊᴜꜱᴛɪɴɴɴɴɴ ɪꜱ ᴛʜᴇ ᴍᴏᴏᴅ"
];

let index = 0;
let botClient = null;

async function updateCurrentStatus() {
  if (!botClient || statuses.length === 0) return;

  await botClient.updatePresence(0, {
    since: null,
    activities: [
      {
        name: "custom",
        type: 4,
        state: statuses[index]
      }
    ],
    status: "idle",
    afk: false
  });

  index = (index + 1) % statuses.length;
}

async function setStatus(client) {
  botClient = client;

  await updateCurrentStatus();

  setInterval(updateCurrentStatus, 10_000);
}

async function setCustomStatuses(newStatuses) {
  if (!newStatuses.length || !botClient) return;

  statuses = newStatuses;
  index = 0;

  await updateCurrentStatus();
}

module.exports = {
  setStatus,
  setCustomStatuses
};

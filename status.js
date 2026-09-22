const statuses = [
  "ᴋᴇᴇᴘ ꜰᴀʟʟɪɴɢ ɪɴ ʟᴏᴠᴇ ᴡɪᴛʜ ʟᴀɴᴀ ᴅᴇʟ ʀᴇʏ",
  "ᴍᴏɢɢɪɴɢ ɪꜱ ᴀ ꜱɪᴅᴇ ʜᴜꜱᴛʟᴇ ꜰᴏʀ ᴊᴏʀᴅᴀɴ ʙᴀʀʀᴇᴛᴛ",
  "ᴢᴀʏɴ ᴍᴀʟɪᴋ ɪꜱ ᴛʜᴇ ɢᴏᴀᴛ",
  "ᴊᴜꜱᴛɪɴɴɴɴɴ ɪꜱ ᴛʜᴇ ᴍᴏᴏᴅ"
];

async function setStatus(client) {
  let index = 0;

  const update = async () => {
    await client.updatePresence(0, {
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
  };

  // Set first status immediately
  await update();

  // Change status every 10 seconds
  setInterval(update, 10_000);
}

module.exports = { setStatus };

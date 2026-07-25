const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// تسجيل أمر الـ Slash Command
const commands = [
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('تشغيل أغنية من الملفات المرفوعة')
        .addStringOption(option =>
            option.setName('song')
                .setDescription('اسم الأغنية أو جزء منها')
                .setRequired(true))
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}! Bot is ready.`);

    // تسجيل الأوامر في سيرفرك (تحديث فوري)
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('Started refreshing application (/) commands.');
        // إذا تبيه عام لكل السيرفرات خذ Routes.applicationCommands(client.user.id)
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'play') {
        const voiceChannel = interaction.member?.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ يا طويل العمر لازم تدخل روم صوتي أول!', ephemeral: true });
        }

        const songName = interaction.options.getString('song');

        let targetPath = __dirname;
        if (fs.existsSync(path.join(__dirname, 'audio audio'))) {
            targetPath = path.join(__dirname, 'audio audio');
        }

        const files = fs.readdirSync(targetPath);
        const matchedFile = files.find(file => file.toLowerCase().includes(songName.toLowerCase()) && (file.endsWith('.mp3') || file.endsWith('.mp4')));

        if (!matchedFile) {
            const availableSongs = files.filter(f => f.endsWith('.mp3') || f.endsWith('.mp4')).map(f => `- ${f}`).join('\n');
            return interaction.reply({ content: `❌ ما حصلت أغنية بهذا الاسم! الأغاني الموجودة عندك:\n${availableSongs}`, ephemeral: true });
        }

        const filePath = path.join(targetPath, matchedFile);

        try {
            await interaction.deferReply();

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            const player = createAudioPlayer();
            const resource = createAudioResource(filePath);

            connection.subscribe(player);
            player.play(resource);

            await interaction.editReply(`🎶 جاري تشغيل الآن: **${matchedFile}**`);

            player.on(AudioPlayerStatus.Idle, () => {
                connection.destroy();
            });

        } catch (error) {
            console.error(error);
            if (interaction.deferred) {
                await interaction.editReply('❌ صار خطأ أثناء محاولة تشغيل الصوت.');
            }
        }
    }
});

client.login(process.env.TOKEN);

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

const FIXED_VOICE_CHANNEL_ID = '1529174493753508062'; 

// جلب الملفات المرفوعة وتصفيتها
const files = fs.readdirSync(__dirname).filter(file => 
    file.endsWith('.mp3') || file.endsWith('.wav') || 
    file.includes('اخذ') || file.includes('جابك') || file.includes('نتغير')
);

const choices = files.map(file => ({ 
    name: file.length > 100 ? file.substring(0, 97) + '...' : file, 
    value: file 
}));

const commands = [
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('تشغيل الأغاني والملفات المرفوعة')
        .addStringOption(option =>
            option.setName('song')
                .setDescription('اختر الأغنية أو الملف المطلوب')
                .setRequired(true)
                .addChoices(...(choices.length > 0 ? choices.slice(0, 25) : [{ name: 'لا توجد ملفات', value: 'none' }]))
        )
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    try {
        const guild = client.guilds.cache.first();
        if (guild) {
            const channel = guild.channels.cache.get(FIXED_VOICE_CHANNEL_ID);
            if (channel) {
                joinVoiceChannel({
                    channelId: channel.id,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator,
                });
                console.log(`دخل الروم الثابت بنجاح: ${channel.name}`);
            }
        }
    } catch (e) {
        console.log('خطأ في دخول الروم:', e);
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('تم تسجيل الأوامر بنجاح.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'play') {
        const songName = interaction.options.getString('song');
        
        if (songName === 'none') {
            return interaction.reply({ content: 'ما فيه أي ملفات مرفوعة حالياً!', ephemeral: true });
        }

        const guild = interaction.guild;
        const channel = guild.channels.cache.get(FIXED_VOICE_CHANNEL_ID);

        if (!channel) {
            return interaction.reply({ content: 'ما قدرت ألقى الروم الثابت، تأكد من الآي دي!', ephemeral: true });
        }

        const filePath = path.join(__dirname, songName);

        if (!fs.existsSync(filePath)) {
            return interaction.reply({ content: `ما لقيت الملف بهذا الاسم: **${songName}**`, ephemeral: true });
        }

        try {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });

            const player = createAudioPlayer();
            const resource = createAudioResource(filePath);

            connection.subscribe(player);
            player.play(resource);

            await interaction.reply(`ابشر يا مجيد، جاري تشغيل: **${songName}** 🎵`);

            player.on(AudioPlayerStatus.Idle, () => {});

        } catch (error) {
            console.error('خطأ تشغيل الصوت:', error);
            await interaction.reply({ content: 'صار خطأ تأكد إن الملف صوته حقيقي ومناسب للتشغيل.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

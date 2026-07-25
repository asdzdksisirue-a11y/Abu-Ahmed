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

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // قراءة جميع الملفات الموجودة في المجلد عدا الملفات البرمجية الأساسية
    const files = fs.readdirSync(__dirname).filter(file => 
        !file.endsWith('.js') && !file.endsWith('.json') && !file.startsWith('.')
    );

    const choices = files.length > 0 
        ? files.slice(0, 25).map(file => ({ name: file.substring(0, 100), value: file }))
        : [{ name: 'لا توجد ملفات مرفوعة', value: 'none' }];

    const commands = [
        new SlashCommandBuilder()
            .setName('play')
            .setDescription('تشغيل الملفات المرفوعة في الروم الثابت')
            .addStringOption(option =>
                option.setName('song')
                    .setDescription('اختر الملف المطلوب')
                    .setRequired(true)
                    .addChoices(...choices)
            )
    ].map(command => command.toJSON());

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
        console.log('تم تحديث وتسجيل الأوامر بنجاح.');
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
            await interaction.reply({ content: 'صار خطأ، تأكد أن الملف مرفوع بصيغة صوت صحيحة (مثل MP3).', ephemeral: true });
        }
    }
});

client.login(process.env.DISOURCE_TOKEN || process.env.DISCORD_TOKEN);

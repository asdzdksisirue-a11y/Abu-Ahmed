const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');

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

    const commands = [
        new SlashCommandBuilder()
            .setName('play')
            .setDescription('تشغيل أغنية عبر الرابط مباشرة')
            .addStringOption(option =>
                option.setName('url')
                    .setDescription('حط رابط الأغنية (مثلاً من ساوندكلاود)')
                    .setRequired(true)
            )
    ].map(command => command.toJSON());

    // دخول الروم الثابت تلقائياً أول ما يشتغل البوت
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
        const url = interaction.options.getString('url');

        const guild = interaction.guild;
        const channel = guild.channels.cache.get(FIXED_VOICE_CHANNEL_ID);

        if (!channel) {
            return interaction.reply({ content: 'ما قدرت ألقى الروم الثابت، تأكد من الآي دي!', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            // الاتصال بالروم الصوتي
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });

            // سحب الصوت من الرابط مباشرة باستخدام play-dl
            const stream = await play.stream(url);
            const resource = createAudioResource(stream.stream, {
                inputType: stream.type
            });

            const player = createAudioPlayer();
            connection.subscribe(player);
            player.play(resource);

            await interaction.editReply(`ابشر يا مجيد، جاري تشغيل الرابط الذي أرسلته 🎵`);

            player.on(AudioPlayerStatus.Idle, () => {
                // انتهت الأغنية
            });

        } catch (error) {
            console.error('خطأ في سحب الصوت:', error);
            await interaction.editReply('عذراً، صار خطأ في سحب الصوت من هذا الرابط. تأكد أن الرابط صحيح (يفضل استخدام روابط SoundCloud).');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

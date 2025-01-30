// dependencias
const Discord = require('discord.js');
const fs = require('fs');
const mongoose = require('mongoose');

// cliente de discord
const client = new Discord.Client({
  intents: 53608447,
});

// Conectar a MongoDB usando MONGO_URI de las variables de entorno
mongoose.connect(process.env.MONGO_URI, {
  
  serverSelectionTimeoutMS: 5000 // Tiempo de espera de 5 segundos
})
  .then(() => console.log('Conectado a MongoDB'))
  .catch(err => console.error('Error de conexión a MongoDB:', err));

// cargar comandos
client.commands = new Discord.Collection();

fs.readdirSync("./commands").forEach((commandfile) => {
  const command = require(`./commands/${commandfile}`);
  client.commands.set(command.data.name, command);
});

// registrar comandos globales
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const rest = new REST({ version: '10' }).setToken(process.env.CLIENT_TOKEN); // Usar CLIENT_TOKEN de las variables de entorno

const clientId = process.env.CLIENT_ID; // Acceder a CLIENT_ID de las variables de entorno

(async () => {
  try {
    // Registra comandos globales
    await rest.put(
      Routes.applicationCommands(clientId), // Registro de comandos globales
      {
        body: client.commands.map((cmd) => cmd.data.toJSON()),
      }
    );
    console.log(`Loaded ${client.commands.size} global slash commands.`);
  } catch (error) {
    console.log("Error loading commands: ", error);
  }
})();

// conexión (eventos)
client.on('ready', () => {
  console.log('Matthew is ready!');
  setInterval(() => {
    let status = [
      {
        name: `join to .gg/wonho`,
        type: Discord.ActivityType.Playing,
      },
      {
        name: `responding to commands...`,
        type: Discord.ActivityType.Custom,
      },
    ]; 
    let random = Math.floor(Math.random() * status.length); 
    client.user.setActivity(status[random]);
  }, 50000); // TIEMPO DE ROTACION
});

// Evento de InteractionCreate: Se ejecuta cuando se crea una interacción (comando)
client.on("interactionCreate", async (interaction) => {
  // Si la interacción es un SlashCommand
  if (interaction.isCommand()) {
    // Obtiene datos del comando
    const command = client.commands.get(interaction.commandName);

    // Ejecuta el comando
    if (command) {
      try {
        await command.execute(interaction); // Ejecutar el comando
      } catch (error) {
        console.error('Error al ejecutar el comando:', error);
        await interaction.reply({ content: 'Ocurrió un error al procesar el comando.', ephemeral: true });
      }
    } else {
      await interaction.reply({ content: 'Comando no encontrado.', ephemeral: true });
    }
  }
});

// Aquí agregamos el evento `interactionCreate` para manejar autocompletado
const { Events } = require('discord.js');  // Asegúrate de importar los eventos

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    // Aquí se maneja la ejecución de los comandos normales
  } else if (interaction.isAutocomplete()) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(error);
    }
  }
});

// conexión (token)
client.login(process.env.CLIENT_TOKEN); // Usar CLIENT_TOKEN de las variables de entorno

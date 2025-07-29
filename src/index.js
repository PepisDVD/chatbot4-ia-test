const { useMultiFileAuthState, default: makeWASocket, DisconnectReason } = require("baileys");
const QRCode = require('qrcode');
const axios = require('axios');

const userContext = {}

require('dotenv').config();

async function connectToWhatsApp () {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    const sock = makeWASocket({
        // can provide additional config here
        auth: state,
    });

    sock.ev.on("creds.update",saveCreds);

    sock.ev.on('connection.update', async (update) => {
    const {connection, lastDisconnect, qr } = update
    // on a qr event, the connection and lastDisconnect fields will be empty
    if(connection === 'close'){
            const puedeConectarse = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if(puedeConectarse){
                connectToWhatsApp();
            }

    }else if(connection==='open'){ //la conexion está abierta?
                console.log('CONEXION ABIERTA!');
    }
    
    // In prod, send this string to your frontend then generate the QR there
    if (qr) {
        // as an example, this prints the qr code to the terminal
        console.log(await QRCode.toString(qr, {type:'terminal', small:true}))
    }
    });

    //Recibir mensajes
    sock.ev.on('messages.upsert', async (event) => {
       console.log(event.messages[0]); 
        for( const m of event.messages){
            //Variables de control
            const nombre = m.pushName; //quien?
            const id = m.key.remoteJid;

            if(nombre != 'Ems'){
                console.log("No es Emily")
                return;
            }

            if(m.message == null || m.message==undefined){ //Verificamos que la estructura tiene Mensaje asociado
                console.log("Mensaje descartado de " + nombre + " por no contener mensaje");
                return;
            }

            if(event.type != 'notify' || m.key.fromMe || id.includes('@s.us') || id.includes('@broadcast') || id.includes('@g.us')){ //Si no es mensaje nuevo o si yo me estoy escribiendo o si es un mensaje personal o si es mensaje de difusión, acaba el proceso
                //El bot espera que sea notify (nuevo) y sea de otro cliente.
                console.log("Mensaje descartado de " + nombre + " por ser de grupo, mio o mandado desde la web");
                return; //Si no retornamos empezerá un bucle y se empezará a mandar un mensaje infinito.
            }
            //Para capturar un mensaje de web o movil :D
            const mensaje =m.message?.conversation || m.message?.extendedTextMessage.text;

            if(!userContext[id]){ //PARA CREAR EL HISTORIAL PARA EL USUARIO
                userContext[id] = {list_mensajes: []};
            }

            //Interacción con OpenAI
            const respuestaOpenAI = await conectarConOpenAI(mensaje,id);

            //Mensaje de prueba -> ACÁ YA EMPEZAMOS A TRABAJAR
            await sock.sendMessage(id,{text: respuestaOpenAI});
        }
    });

}

// run in main file
connectToWhatsApp()


// PRUEBA CONEXIÓN CON OPENAI PARA GENERAR TEXTO
async function conectarConOpenAI(mensaje,id) { 

    //Para conectar con una API externa para probar inventario (EJEMPLO)
    const productos = await axios.get("https://fakestoreapi.com/products");


    if(userContext[id]?.list_mensajes.length == 0){ //Si es nuevo, le añadimos la configuración inicial para las respuestas
        userContext[id].list_mensajes = [
            {
                "role": "system",
                "content": "Actua como parte del equipo de ventas del negocio (tienda de electronica). Responde en máximp 25 palabras y no respondas de otro tema."
            },
            {
                "role": "user",
                "content": "Holaa, Tiene monitores?"
            },
            {
                "role": "assistant",
                "content": "No, en este momento no contamos con monitores, solo tenemos:  "+JSON.stringify(productos.data) //Convertimos a JSON para procesar lo que se trae de la API
            }
        ]
    }
    //Agregamos la pregunta como parte de su historial
    userContext[id].list_mensajes.push({
        "role": "user",
        "content": mensaje
    })

    try {
        const { data } = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                "model": "gpt-4.1",
                "messages": userContext[id]?.list_mensajes //Para que tenga una pequeña MEMORIA de los mensajes 
            },
            {
                headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
                }
            }
        );
        console.log(data.choices[0].message.content);
        //ALMACENAMOS LAS RESPUESTA
        userContext[id].list_mensajes.push(data.choices[0].message);
        return data.choices[0].message.content;

    } catch (error) {
        console.error("Error al conectarse con OpenAI:", error.response?.data || error.message);
    }
}
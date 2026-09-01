import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

interface MailOptions {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
}

const smtpPort = Number(process.env.EMAIL_PORT || 587);

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: true,
    },
});

export const sendEmailRegister = async (username: string): Promise<void> => {
    if (typeof username !== 'string' || !username.includes('@') || /[\r\n]/.test(username)) {
        throw new Error('Destinatario de correo no válido');
    }

    const mailOptions: MailOptions = {
        from: process.env.EMAIL_USER as string,
        to: username,
        subject: 'Bienvenido a Nuestra Plataforma',
        text: `Hola ${username},\n\nGracias por registrarte en nuestra plataforma. ¡Estamos encantados de tenerte con nosotros!`,
        html: `<b>Hola ${username}</b>,<br><br>Gracias por registrarte en nuestra plataforma. ¡Estamos encantados de tenerte con nosotros!`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Correo de bienvenida enviado con éxito');
    } catch (error) {
        console.error('Error al enviar correo de bienvenida:', error);
        throw error;
    }
};

export default sendEmailRegister;

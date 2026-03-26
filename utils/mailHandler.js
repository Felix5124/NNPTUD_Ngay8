const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 25,
    secure: false, // Use true for port 465, false for port 587
    auth: {
        user: "",
        pass: "",
    },
});
module.exports = {
    sendMail: async function (to,url) {
        const info = await transporter.sendMail({
            from: 'hehehe@gmail.com',
            to: to,
            subject: "reset password URL",
            text: "click vao day de doi pass", // Plain-text version of the message
            html: "click vao <a href="+url+">day</a> de doi pass", // HTML version of the message
        });

        console.log("Message sent:", info.messageId);
    },
    sendInitialPasswordMail: async function (to, username, password) {
        const info = await transporter.sendMail({
            from: "hehehe@gmail.com",
            to: to,
            subject: "Tai khoan moi cua ban",
            text: "Tai khoan: " + username + "\nMat khau tam: " + password + "\nVui long dang nhap va doi mat khau.",
            html:
                "Tai khoan: <b>" +
                username +
                "</b><br/>Mat khau tam: <b>" +
                password +
                "</b><br/>Vui long dang nhap va doi mat khau.",
        });

        console.log("Message sent:", info.messageId);
    }
}

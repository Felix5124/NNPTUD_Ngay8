var express = require("express");
var router = express.Router();
let { validatedResult, CreateUserValidator, ModifyUserValidator } = require("../utils/validator")
let userModel = require("../schemas/users");
let userController = require("../controllers/users");
let roleModel = require("../schemas/roles");
const { checkLogin,checkRole } = require("../utils/authHandler");
let { uploadExcel } = require("../utils/uploadHandler");
let path = require("path");
let excelJs = require("exceljs");
let crypto = require("crypto");
let { sendInitialPasswordMail } = require("../utils/mailHandler");

function generateRandomPassword(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.?";
  const randomBytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}


router.get("/", checkLogin,checkRole("ADMIN","MODERATOR"), async function (req, res, next) {
  let users = await userModel
    .find({ isDeleted: false })
  res.send(users);
});

router.get("/:id", async function (req, res, next) {
  try {
    let result = await userModel
      .find({ _id: req.params.id, isDeleted: false })
    if (result.length > 0) {
      res.send(result);
    }
    else {
      res.status(404).send({ message: "id not found" });
    }
  } catch (error) {
    res.status(404).send({ message: "id not found" });
  }
});

router.post("/", CreateUserValidator, validatedResult, async function (req, res, next) {
  try {
    let newUser = await userController.CreateAnUser(
      req.body.username, req.body.password, req.body.email,
      req.body.role, req.body.fullname, req.body.avatarUrl
    )
    res.send(newUser);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post("/import", checkLogin, checkRole("ADMIN", "MODERATOR"), uploadExcel.single("file"), async function (req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).send({ message: "thieu file import" });
    }

    const userRole = await roleModel.findOne({ name: { $regex: /^user$/i }, isDeleted: false });
    if (!userRole) {
      return res.status(400).send({ message: "khong tim thay role user" });
    }

    let workBook = new excelJs.Workbook();
    let pathFile = path.join(__dirname, "../uploads", req.file.filename);
    await workBook.xlsx.readFile(pathFile);

    let worksheet = workBook.worksheets[0];
    if (!worksheet) {
      return res.status(400).send({ message: "file excel khong co du lieu" });
    }

    let result = [];
    let importedUsernames = new Set();
    let importedEmails = new Set();

    for (let index = 2; index <= worksheet.rowCount; index++) {
      let row = worksheet.getRow(index);
      let username = (row.getCell(1).value || "").toString().trim();
      let email = (row.getCell(2).value || "").toString().trim().toLowerCase();
      let rowError = [];

      if (!username) {
        rowError.push("username khong duoc de trong");
      }
      if (!email) {
        rowError.push("email khong duoc de trong");
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (email && !emailRegex.test(email)) {
        rowError.push("email sai dinh dang");
      }

      if (importedUsernames.has(username)) {
        rowError.push("username bi trung trong file");
      }
      if (importedEmails.has(email)) {
        rowError.push("email bi trung trong file");
      }

      const existingUserByUsername = username ? await userController.FindUserByUsername(username) : null;
      const existingUserByEmail = email ? await userController.FindUserByEmail(email) : null;
      if (existingUserByUsername) {
        rowError.push("username da ton tai");
      }
      if (existingUserByEmail) {
        rowError.push("email da ton tai");
      }

      if (rowError.length > 0) {
        result.push({
          row: index,
          success: false,
          data: rowError,
        });
        continue;
      }

      const password = generateRandomPassword(16);

      try {
        let newUser = await userController.CreateAnUser(
          username,
          password,
          email,
          userRole._id
        );

        try {
          await sendInitialPasswordMail(email, username, password);
        } catch (mailError) {
          await userModel.findByIdAndDelete(newUser._id);
          throw new Error("tao user thanh cong nhung gui mail that bai: " + mailError.message);
        }

        importedUsernames.add(username);
        importedEmails.add(email);

        result.push({
          row: index,
          success: true,
          data: {
            _id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            role: userRole.name,
          },
        });
      } catch (error) {
        result.push({
          row: index,
          success: false,
          data: [error.message],
        });
      }
    }

    res.send(result);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put("/:id", ModifyUserValidator, validatedResult, async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedItem) return res.status(404).send({ message: "id not found" });

    let populated = await userModel
      .findById(updatedItem._id)
    res.send(populated);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }
    res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;
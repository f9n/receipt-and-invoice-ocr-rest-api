const Tesseract = require("node-tesseract-ocr");
const express = require("express");
const app = express();
const multer = require("multer");

const PORT = process.env.PORT || 5000;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const config = {
  lang: "tur",
  oem: 1,
  psm: 3,
};

const upload = multer({ storage: storage });

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/api/upload", upload.single("uploadedImage"), (req, res) => {
  console.log(req.file);
  try {
    Tesseract.recognize("uploads/" + req.file.filename, config)
      .then((text) => {
        return res.json(regex(text));
      })
      .catch((error) => {
        console.log(error.message);
      });
  } catch (error) {
    console.error(error);
  }
});

app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});

function regex(text) {
  let sp = text.split("\r\n");
  var result = [];
  var result2 = [];
  var tarih = null;
  let kdv = null;
  let tutar = null;
  var products = [];
  var products_unclear = [];
  let str = null;
  let str1 = null;
  let product_index;

  for (let index = 0; index < sp.length; index++) {
    if (sp[index] != "") result2.push({ line: sp[index] });
  }

  console.log(result2);

  for (let index = 0; index < sp.length; index++) {
    console.log("1");
    // if (sp[index].includes("TARİH") ){
    if (sp[index].match(/\d{2}([\/.-])\d{2}\1\d{4}/g)) {
      var tarih = sp[index].match(/\d{2}([\/.-])\d{2}\1\d{4}/g);
      //result.push({TARİH: tarih});
    }

    console.log("11" + "sp:" + sp[index] + "index" + index);
    if (sp[index].includes("KDV")) {
      console.log("kdv");
      if (!product_index) product_index = index;
      str = sp[index].split("*");

      if (str[1] != null) {
        kdv = str[1];
      }
      console.log("2");
    } else {
      console.log("3");
      if (sp[index].includes("TOP")) str1 = sp[index].split("*");
      console.log("alooo" + str1);
      if (str1 != null) tutar = str1[1];
    }
  }
  console.log(product_index);
  product_index--;
  while (
    product_index >= 0 &&
    !sp[product_index].includes("FİŞ") &&
    !sp[product_index].includes("SAAT") &&
    !sp[product_index].includes("FIS")
  ) {
    products_unclear.push(sp[product_index]);
    product_index--;
  }
  console.log("u nclear:" + products_unclear);
  for (let index = 0; index < products_unclear.length; index++) {
    if (products_unclear[index] && products_unclear[index].length > 7)
      products.push(products_unclear[index]);
  }

  console.log(products);

  let tarihjson;
  if (result2[0]) tarihjson = result2[0].line;
  else tarihjson = null;

  result.push({
    firm: tarihjson,
    date: tarih[0],
    total_kdv: kdv,
    total_amount: tutar,
  });

  let p_tutar = null;
  let p_adet = null;
  let p_name = null;
  let p_kdv = null;
  let category;
  var length_pro = null;

  for (let index = 0; index < products.length; index++) {
    const element = products[index];
    length_pro = element;
    console.log("element:" + element);
    if (element.includes("*")) {
      length_pro = element.split("*");
      p_tutar = length_pro[1];
    }

    if (!length_pro) length_pro = element;

    if (length_pro[0].includes("%")) {
      length_pro = length_pro[0].split("%");
      p_kdv = length_pro[1];
    }

    if (length_pro[0].includes("X")) {
      let length_pro = length_pro[0].split("X");
      p_adet = length_pro[1];
    }

    if (length_pro[0].length > 1) p_name = length_pro[0];
    else p_name = length_pro;

    result.push({
      name: p_name,
      quantity: p_adet,
      unitPrice: p_tutar,
      ratiokdv: p_kdv,
      category: null,
    });

    p_adet = null;
    p_kdv = null;
    p_name = null;
    p_tutar = null;
  }

  console.log(result);
  return result;
}

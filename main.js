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

// https://github.com/f9n/receipt-and-invoice-rest-api/blob/main/contrib/images/receipts/WhatsApp%20Image%202021-12-07%20at%2009.38.10%20(6).jpeg

var floating_regex = /\d+[,.]?\d+/;
var verbal_regex = /[a-zA-Z \#]+/;
var kdv_regex = /%\d{2}/;

function regex(text) {
  /*console.log(text)*/
  let sp = text.split("\n");

  var result = [];
  var result2 = [];
  var tarih = null;
  let total_kdv = null;
  let total_amount = null;
  var products = [];
  var products_unclear = [];
  var product_json;
  let str = null;
  let str1 = null;
  let product_index;

  for (let index = 0; index < sp.length; index++) {
    if (sp[index] != "") result2.push({ line: sp[index] });
  }
  console.log(result2);

  for (let index = 0; index < sp.length; index++) {
    // if (sp[index].includes("TARİH") ){
    if (sp[index].match(/\d{2}([\/.-])\d{2}\1\d{4}/g)) {
      var tarih = sp[index].match(/\d{2}([\/.-])\d{2}\1\d{4}/g);
      //result.push({TARİH: tarih});
    }

    console.log("11" + "sp:" + sp[index] + "index" + index);
    if (sp[index].includes("KDV") || sp[index].includes("KDY")) {
      if (product_index == null) {
        total_kdv = sp[index].match(floating_regex);
        product_index = index;
        console.log(`total_kdv: ${total_kdv}`);
        console.log(`index: ${index}`);
      }
    } else {
      if (sp[index].includes("TOP")) {
        total_amount = sp[index].match(floating_regex);
        console.log(`total_amount: ${total_amount}`);
      }
    }
  }
  console.log(product_index);
  product_index--;
  while (
    product_index >= 0 &&
    !sp[product_index].includes("FİŞ") &&
    !sp[product_index].includes("SAAT") &&
    !sp[product_index].includes("FIS") &&
    !sp[product_index].includes("Fiş") &&
    !sp[product_index].includes("NO")
  ) {
    products_unclear.push(sp[product_index]);
    product_index--;
  }
  console.log(`Unclear: ${products_unclear}`);
  for (let index = 0; index < products_unclear.length; index++) {
    if (products_unclear[index] && products_unclear[index].length > 7)
      products.push(products_unclear[index]);
  }

  console.log(products);
  console.log(result2[0]);
  console.log(`Tarih: ${tarih}`);

  let firmjson;
  if (result2[0]) firmjson = result2[0].line;

  result.push({
    firm: firmjson,
    date: tarih,
    no: null,
    total_kdv: total_kdv,
    total_amount: total_amount,
  });

  let p_quantity = null;
  let p_name = null;
  let p_ratiokdv = null;
  let p_unitPrice = null;
  let p_category = null;

  /*
                                                  [
    2022-06-12T18:37:31.703243+00:00 app[web.1]:   'Kredi Kartı *81,90',
    2022-06-12T18:37:31.703244+00:00 app[web.1]:   'TOPLAM «81,90',
    2022-06-12T18:37:31.703244+00:00 app[web.1]:   'TOPKDV x12, 49',
    2022-06-12T18:37:31.703244+00:00 app[web.1]:   'GLADE SPORT MANGOK#LAVAN 415 x29,90',
    2022-06-12T18:37:31.703244+00:00 app[web.1]:   'AUTOMIX PDA TUTUCU 118 *52,00',
    2022-06-12T18:37:31.703244+00:00 app[web.1]:   'Fiş NO : 0182'
    2022-06-12T18:37:31.703244+00:00 app[web.1]: ]
  */

  for (const product of products) {
    console.log("Product:" + product);

    p_unitPrice = product.match(floating_regex);
    p_name = product.match(verbal_regex);
    p_ratiokdv = product.match(kdv_regex);

    result.push({
      name: p_name,
      quantity: p_quantity,
      unitPrice: p_unitPrice,
      ratiokdv: p_ratiokdv,
      category: p_category,
    });

    p_name = null;
    p_quantity = null;
    p_unitPrice = null;
    p_ratiokdv = null;
  }

  console.log(result);
  return result;
}

function regex2(text) {
  // let sp = text.split("\r\n");
  let sp = text.split("\n");

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

  let firm = null;
  if (result2[0]) firm = result2[0].line;

  result.push({
    firm: firm,
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

  for (const element of products) {
    length_pro = element;
    console.log("element:" + element);
    if (element.includes("*")) {
      length_pro = element.split("*");

      if (length_pro[1]) p_tutar = length_pro[1];
    }

    if (!length_pro) length_pro = element;

    if (length_pro[0].includes("%")) {
      length_pro = length_pro[0].split("%");
      if (length_pro[1]) p_kdv = length_pro[1];
    }

    if (length_pro[0].includes("X")) {
      let length_pro = length_pro[0].split("X");
      if (length_pro[1]) p_adet = length_pro[1];
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

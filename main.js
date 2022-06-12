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

function replaceAll(string, search, replace) {
  return string.split(search).join(replace);
}

// https://github.com/f9n/receipt-and-invoice-rest-api/blob/main/contrib/images/receipts/WhatsApp%20Image%202021-12-07%20at%2009.38.10%20(6).jpeg

var floating_regex = /\d+[,.]?\d+/;
var total_kdv_regex = /\d+[,.]?\d+/;
var verbal_regex = /[^\d]+/;
// var document_no_regex = /[ ]?[Nn][Oo]\:[ ]?\d+/;
var product_amount_regex = /\d+[,.]?\d+$/;
var product_kdv_regex = /[%](\d{2})/;
var date_regex = /\d{2}([\/.-])\d{2}\1\d{4}/g;

function regex(text) {
  /*console.log(text)*/
  let sp = text.split("\n");

  var result = [];
  var result2 = [];
  var date = null;
  let document_no = null;
  let total_kdv = null;
  let total_amount = null;
  var products = [];
  var products_unclear = [];
  let product_index;
  let document_type_flag = 1;
  let _total_kdv;
  let tmp;

  for (let index = 0; index < sp.length; index++) {
    if (sp[index] != "" && sp[index] != " ") {
      result2.push({ line: sp[index] });
    }
  }
  console.log(result2);

  for (let index = 0; index < sp.length; index++) {
    // date
    if (sp[index].match(date_regex)) {
      date = sp[index].match(date_regex);
    }

    // kdv
    if (sp[index].includes("KDV") || sp[index].includes("KDY")) {
      if (product_index == null) {
        _total_kdv = replaceAll(sp[index], " ", "");
        total_kdv = _total_kdv.match(total_kdv_regex);
        product_index = index;
        console.log(`total_kdv: ${total_kdv}`);
        console.log(`index: ${index}`);
      }
    } else {
      // total amount
      if (sp[index].includes("TOP")) {
        total_amount = sp[index].match(floating_regex);
        console.log(`total_amount: ${total_amount}`);
      }
    }

    if (
      sp[index].includes("FİŞ") ||
      sp[index].includes("FIS") ||
      sp[index].includes("Fiş") ||
      sp[index].includes("FIŞ")
    ) {
      // fis no
      document_no = sp[index].match(/\d+/);
    }
  }
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
  for (let index = 0; index < products_unclear.length; index++) {
    if (products_unclear[index] && products_unclear[index].length > 7)
      products.push(products_unclear[index]);
  }

  console.log(`Date: ${date}`);

  let firm;
  if (result2[0]) firm = result2[0].line;

  result.push({
    firm: firm,
    date: date,
    no: document_no,
    total_kdv: total_kdv,
    total_amount: total_amount,
  });

  for (let index = 0; index < sp.length; index++) {
    if (
      (sp[index].includes("ADET") ||
        sp[index].includes("Adt") ||
        sp[index].includes("KG")) &&
      !sp[index].includes("*")
    ) {
      document_type_flag = 2;
    }
  }
  let result_products;
  if (document_type_flag == 1) {
    console.log("Process Type: 1");
    result_products = process_type1_receipt(products);
  } else if (document_type_flag == 2) {
    console.log("Process Type: 2");
    result_products = process_type2_receipt(products);
  }

  result.push(...result_products);

  console.log(result);
  return result;
}

function process_type2_receipt(products) {
  let return_result = [];
  let p_quantity = 1;
  let p_name = null;
  let p_ratiokdv = null;
  let p_unitPrice = null;
  let p_category = null;
  let tmp = null;
  let quantity_flag = false;

  let _products = products.reverse();
  console.log(_products)

  for (const product of _products) {
    console.log("Product:" + product);

    // 1. ci adeti
    if (
      (product.includes("ADET") ||
        product.includes("Adt") ||
        product.includes("KG")) &&
      !product.includes("*")
    ) {
      quantity_flag = true;
      p_unitPrice = product.match(product_amount_regex);
      // @TODO: kritik. bunu float olarak bulmaliyiz. suanlik ilk index.
      p_quantity = product[0];
      // 1. cinin urunun
    } else if (quantity_flag == true) {
      p_name = product.match(verbal_regex);
      tmp = product.match(product_kdv_regex);
      if (tmp != null && tmp.length >= 2) {
        p_ratiokdv = tmp[1];
      }
      return_result.push({
        name: p_name,
        quantity: p_quantity,
        unitPrice: p_unitPrice,
        ratiokdv: p_ratiokdv,
        category: p_category,
      });

      p_name = null;
      p_quantity = 1;
      p_unitPrice = null;
      p_ratiokdv = null;

      quantity_flag = false;
      // ciplak urun (adeti olmayan)
    } else {
      p_name = product.match(verbal_regex);
      p_unitPrice = product.match(product_amount_regex);
      tmp = product.match(product_kdv_regex);
      if (tmp != null && tmp.length >= 2) {
        p_ratiokdv = tmp[1];
      }

      return_result.push({
        name: p_name,
        quantity: p_quantity,
        unitPrice: p_unitPrice,
        ratiokdv: p_ratiokdv,
        category: p_category,
      });

      p_name = null;
      p_quantity = 1;
      p_unitPrice = null;
      p_ratiokdv = null;
    }
  }

  return [];
}

function process_type1_receipt(products) {
  let return_result = [];
  let p_quantity = 1;
  let p_name = null;
  let p_ratiokdv = null;
  let p_unitPrice = null;
  let p_category = null;
  let tmp = null;

  console.log(products)

  for (const product of products) {
    console.log("Product:" + product);

    p_name = product.match(verbal_regex);
    p_unitPrice = product.match(product_amount_regex);
    tmp = product.match(product_kdv_regex);
    if (tmp != null && tmp.length >= 2) {
      p_ratiokdv = tmp[1];
    }

    return_result.push({
      name: p_name,
      quantity: p_quantity,
      unitPrice: p_unitPrice,
      ratiokdv: p_ratiokdv,
      category: p_category,
    });

    p_name = null;
    p_quantity = 1;
    p_unitPrice = null;
    p_ratiokdv = null;
  }

  return return_result;
}

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

  var result = {};
  var clean_text_lines = [];
  // Receipt
  let firm;
  var date = "";
  let document_no = "";
  let total_kdv = "";
  let total_amount = "";
  // Receipt Products
  var products = [];
  var products_unclear = [];
  let product_index;
  let document_type_flag = 1;
  let tmp;

  for (let index = 0; index < sp.length; index++) {
    if (
      sp[index] != "" &&
      sp[index] != " " &&
      sp[index].length > 2 &&
      sp[index].match(/[^ ]+/)
    ) {
      clean_text_lines.push(sp[index]);
    }
  }
  console.log("Clean Text Lines");
  console.log(clean_text_lines);

  if (clean_text_lines[0]) firm = clean_text_lines[0];

  for (let index = 0; index < clean_text_lines.length; index++) {
    // date
    var _date = clean_text_lines[index].match(date_regex);
    if (_date && _date.length > 0) {
      date = clean_text_lines[index].match(date_regex)[0];
    }

    // kdv
    if (
      clean_text_lines[index].includes("KDV") ||
      clean_text_lines[index].includes("KDY") ||
      clean_text_lines[index].includes("TRT") ||
      clean_text_lines[index].includes("TISKUV")
    ) {
      if (product_index == null) {
        let _total_kdv = replaceAll(clean_text_lines[index], " ", "").match(
          total_kdv_regex
        );
        if (_total_kdv && _total_kdv.length > 0) {
          total_kdv = _total_kdv[0];
        }
        product_index = index;
        console.log(`total_kdv: ${total_kdv}`);
        console.log(`index: ${index}`);
      }
    } else {
      // total amount
      if (
        clean_text_lines[index].includes("TOP") ||
        clean_text_lines[index].includes("TİPLAM")
      ) {
        let _total_amount = clean_text_lines[index].match(floating_regex);
        if (_total_amount && _total_amount.length > 0) {
          total_amount = _total_amount[0];
        }
        console.log(`total_amount: ${total_amount}`);
      }
    }

    if (
      clean_text_lines[index].includes("FİŞ") ||
      clean_text_lines[index].includes("FIS") ||
      clean_text_lines[index].includes("Fiş") ||
      clean_text_lines[index].includes("FIŞ")
    ) {
      // fis no
      let _document_no = clean_text_lines[index].match(/\d+/);
      if (_document_no && _document_no.length > 0) {
        document_no = _document_no[0];
      }
    }
  }
  product_index--;
  while (
    product_index >= 0 &&
    !clean_text_lines[product_index].includes("FİŞ") &&
    !clean_text_lines[product_index].includes("SAAT") &&
    !clean_text_lines[product_index].includes("FIS") &&
    !clean_text_lines[product_index].includes("Fiş") &&
    !clean_text_lines[product_index].includes("NO")
  ) {
    console.log(`ProductIndex: ${product_index}`);
    console.log(`ProductUnclear: ${clean_text_lines[product_index]}`);
    products_unclear.push(clean_text_lines[product_index]);
    product_index--;
  }
  for (let index = 0; index < products_unclear.length; index++) {
    if (products_unclear[index] && products_unclear[index].length > 7)
      products.push(products_unclear[index]);
  }

  console.log(`Date: ${date}`);

  result = {
    firm: firm,
    date: date,
    no: document_no,
    total_kdv: total_kdv,
    total_amount: total_amount,
    products: [],
  }

  for (let index = 0; index < clean_text_lines.length; index++) {
    if (
      (clean_text_lines[index].includes("ADET") ||
        clean_text_lines[index].includes("Adt") ||
        clean_text_lines[index].includes("KG")) &&
      !clean_text_lines[index].includes("*")
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

  result.products.push(...result_products);

  console.log(result);
  return result;
}

function get_first_match_or_default(match, base) {
  if (match && match.length > 0) {
    return match[0];
  }
  return base;
}

function process_type2_receipt(products) {
  let return_result = [];

  // Product
  let p_name = "";
  let p_quantity = 1;
  let p_ratiokdv = 0;
  let p_unitPrice = "";
  let p_category = "yiyecek";

  let tmp = null;
  let quantity_flag = false;

  let _products = products.reverse();
  console.log(_products);

  for (const product of _products) {
    console.log("Product:" + product);
    console.log(`Quantity Flag: ${quantity_flag}`);
    // 1. ci adeti
    if (
      (product.includes("ADET") ||
        product.includes("Adt") ||
        product.includes("KG")) &&
      !product.includes("*")
    ) {
      quantity_flag = true;
      p_unitPrice = get_first_match_or_default(
        product.match(product_amount_regex),
        p_unitPrice
      );

      // @TODO: kritik. bunu float olarak bulmaliyiz. suanlik ilk index.
      p_quantity = parseInt(product[0]);
      // 1. cinin urunun
    } else if (quantity_flag) {
      p_name = get_first_match_or_default(product.match(verbal_regex), p_name);

      tmp = product.match(product_kdv_regex);
      if (tmp && tmp.length >= 2) {
        p_ratiokdv = tmp[1];
      }
      return_result.push({
        name: p_name,
        quantity: p_quantity,
        unitPrice: p_unitPrice,
        ratiokdv: p_ratiokdv,
        category: p_category,
      });

      p_name = "";
      p_quantity = 1;
      p_ratiokdv = 0;
      p_unitPrice = "";

      quantity_flag = false;
      // ciplak urun (adeti olmayan)
    } else {
      p_name = get_first_match_or_default(product.match(verbal_regex), p_name);
      p_unitPrice = get_first_match_or_default(
        product.match(product_amount_regex),
        p_unitPrice
      );
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

      p_name = "";
      p_quantity = 1;
      p_ratiokdv = 0;
      p_unitPrice = "";
    }
  }

  return return_result;
}

function process_type1_receipt(products) {
  let return_result = [];

  // product
  let p_name = "";
  let p_quantity = 1;
  let p_ratiokdv = 0;
  let p_unitPrice = "";
  let p_category = "yiyecek";

  let tmp = null;

  console.log(products);

  for (const product of products) {
    console.log("Product:" + product);

    p_name = get_first_match_or_default(product.match(verbal_regex), p_name);
    p_unitPrice = get_first_match_or_default(
      product.match(product_amount_regex),
      p_unitPrice
    );
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

    p_name = "";
    p_quantity = 1;
    p_ratiokdv = 0;
    p_unitPrice = "";
  }

  return return_result;
}

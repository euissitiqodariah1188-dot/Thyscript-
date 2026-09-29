// v3 features smoke test
print("slug: " + v3.slugify("Hello ThyScript World!"))
print("enc/dec: " + v3.decryptAES(v3.encryptAES("rahasia", "kunci123"), "kunci123"))
print("bytes: " + v3.formatBytes(1536000))
print("uuid: " + v3.uuid())
print("localIP: " + v3.localIP())
print("upper masked: " + v3.capitalize(v3.mask("bankaccount123", 4)))
print("csv parse rows: " + v3.parseCSV("a,b\n1,2").length)
print("total features: " + v3.featureCount())
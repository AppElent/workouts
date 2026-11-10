/**
 * Every message here is a failure exit, not just a status line — spec #68
 * requires local Search and Enter manually to stay reachable behind each
 * one, so none of these ever block the screen; they surface as a toast
 * and return to the ordinary Find Food view.
 */
export const nutritionBarcodeEn = {
	scanTitle: "Scan barcode",
	purpose:
		"Allow camera access to scan food barcodes and find nutrition information.",
	allow: "Allow camera access",
	requesting: "Requesting camera access…",
	denied:
		"Camera access was refused. You can still find food with Search or Enter manually.",
	restricted:
		"Camera access is restricted on this device. You can still find food with Search or Enter manually.",
	hint: "Point your camera at a barcode.",
	lookingUp: "Looking up this barcode…",
};

export const nutritionBarcodeNl: typeof nutritionBarcodeEn = {
	scanTitle: "Scan barcode",
	purpose:
		"Geef cameratoegang om voedingsbarcodes te scannen en voedingswaarden te vinden.",
	allow: "Cameratoegang toestaan",
	requesting: "Cameratoegang aanvragen…",
	denied:
		"Cameratoegang is geweigerd. Je kunt eten nog steeds vinden via Zoeken of Handmatig invoeren.",
	restricted:
		"Cameratoegang is beperkt op dit apparaat. Je kunt eten nog steeds vinden via Zoeken of Handmatig invoeren.",
	hint: "Richt je camera op een barcode.",
	lookingUp: "Barcode wordt opgezocht…",
};

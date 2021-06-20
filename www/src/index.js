import { setupReceiptViewComponent } from './comp_receipt_view'
import { setupReceiptListComponent } from './comp_receipt_list'
import { setupScannerComponent } from './comp_scanner'

import './index.css'

if ('serviceWorker' in navigator) {
	if (process.env.NODE_ENV === 'development') {
		navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(x => x.unregister()))
	} else {
		navigator.serviceWorker.register('./service_worker.js')
	}
}

setupScannerComponent()
setupReceiptListComponent()
setupReceiptViewComponent()

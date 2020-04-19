import './c_scanner'
import './c_receipt_list'

if ('serviceWorker' in navigator) {
	if (process.env.NODE_ENV === 'development') {
		navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(x => x.unregister()))
	} else {
		navigator.serviceWorker.register('./service_worker.js')
	}
}

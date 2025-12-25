window.addEventListener('error', e => {
	// looks like plugin error, ignoring it
	if (e.message === 'Script error.' && e.filename === '') return
	// usually, e.message already prefixed with "Uncaught Error:"
	const message = `${e.message} in ${e.filename}:${e.lineno}:${e.colno}`
	alert(message)
})

window.addEventListener('unhandledrejection', e => {
	// in case of Promise.reject("string") error will have no message/stack; passing that "reason" as plain text
	const message =
		'Unhandled Rejection: ' + (e.reason && e.reason.message ? e.reason.message : e.reason + '')
	alert(message)
})

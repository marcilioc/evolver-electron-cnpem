import sys
import time
import socketio
import asyncio
import optparse

VALID_FIT_TYPES = ['sigmoid', 'linear', 'constant', '3d']

sio = socketio.AsyncClient()

@sio.event(namespace='/dpu-evolver')
def connect(*args):
    print("Connected to eVOLVER as client")

@sio.event
def disconnect(*args, namespace='/dpu-evolver'):
    print("Disconnected from eVOLVER as client")

@sio.event
def reconnect(*args, namespace='dpu-evolver'):
    print("Reconnected to eVOLVER as client")

@sio.on('calibration', namespace='/dpu-evolver')
async def on_calibration(data):
    global calibration, data_received
    calibration = data
    print(calibration)
    data_received = True

@sio.on('calibrationnames', namespace='/dpu-evolver')
async def on_calibrationnames(data):
    for calibration_name in data:
        print(data)

async def main(evolverIp, getnames, calname, fitname, fittype, param, nograph):
    await sio.connect(evolverIp, namespaces=['/dpu-evolver'])
    if getnames:
        print("Getting calibration names...")
        await sio.emit('getcalibrationnames', [], namespace = '/dpu-evolver')

    if calname:
        if fitname is None:
            print("Please input a name for the fit!")
            parser.print_help()
            sys.exit(2)
        if fittype not in VALID_FIT_TYPES:
            print("Invalid fit type!")
            parser.print_help()
            sys.exit(2)
        if param is None:
            print("Must provide at least 1 parameter!")
            parser.print_help()
            sys.exit(2)
        if nograph is None:
            nograph = False
        await sio.emit('getcalibration', {'name':calname}, namespace='/dpu-evolver')
        param = params.strip().split(',')

    await sio.sleep(1)
    if calname is not None and not getnames:
          if fittype == "sigmoid":
              print('Selected sigmoid fit')
              fit = sigmoid_fit(calibration, fit_name, params, graph = not no_graph)
          elif fittype == "linear":
              print('Selected linear fit')
              fit = linear_fit(calibration, fit_name, params, graph = not no_graph)
          elif fittype == "constant":
              print('Selected constant fit')
              fit = constant_fit(calibration, fit_name, params, graph = not no_graph)
          elif fittype == "3d":
              print('Selected 3d fit')
              fit = three_dimension_fit(calibration, fit_name, params, graph = not no_graph)

    await sio.wait()


if __name__ == '__main__':
    parser = optparse.OptionParser()
    parser.add_option('-n', '--calibration-name', action = 'store', dest = 'calname', help = "Name of the calibration.")
    parser.add_option('-g', '--get-calibration-names', action = 'store_true', dest = 'getnames', help = "Prints out all calibration names present on the eVOLVER.")
    parser.add_option('-a', '--ip', action = 'store', dest = 'ipaddress', help = "IP address of eVOLVER")
    parser.add_option('-t', '--fit-type', action = 'store', dest = 'fittype', help = "Valid options: sigmoid, linear, constant, 3d")
    parser.add_option('-f', '--fit-name', action = 'store', dest = 'fitname', help = "Desired name for the fit.")
    parser.add_option('-p', '--params', action = 'store', dest = 'params', help = "Desired parameter(s) to fit. Comma separated, no spaces")
    parser.add_option('-y', '--always-yes', action = 'store_true', dest = 'alwaysyes', help = "Skips asking to save calibration to eVOLVER")
    parser.add_option('-r', '--no-graph', action = 'store_true', dest = 'nograph', help = "Skips graphing if provided")

    (options, args) = parser.parse_args()
    cal_name = options.calname
    get_names = options.getnames
    fit_type = options.fittype
    fit_name = options.fitname
    params = options.params
    always_yes = options.alwaysyes
    no_graph = options.nograph

    if not options.ipaddress:
        print('Please specify ip address')
        parser.print_help()
        sys.exit(2)

    ipaddress = 'http://' + options.ipaddress + ':8081'

    asyncio.run(main(ipaddress, get_names, cal_name, fit_name, fit_type, params, no_graph))

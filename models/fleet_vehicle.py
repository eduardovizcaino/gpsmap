from odoo import fields, models
from odoo.exceptions import UserError

import datetime, pytz, json, logging, warnings
_logger = logging.getLogger(__name__)


class vehicle(models.Model):
    _inherit = "fleet.vehicle"
    _order = "economic_number ASC"

    economic_number = fields.Char('Economic Number', size = 50)
    speed = fields.Char(default = 0, size = 3)
    active_time_today = fields.Integer()
    speeding = fields.Boolean(default = False)
    gpsoffline = fields.Boolean(default = False)
    alarm = fields.Boolean(default = False)
    engine = fields.Boolean(default = True, tracking = True)
    ignition = fields.Boolean(default = False)
    gps1_id = fields.Many2one('gps_devices', ondelete = 'set null', string = "GPS", index = True)
    positionid = fields.Many2one('gps_positions', ondelete = 'set null', string = "Position", index = True)
    color_vehicle = fields.Selection([
        ('#0000ff', 'Blue'),
        ('#ff0000', 'Red'),
        ('#fff000', 'Yellow'),
        ('#ffffff', 'White'),
        ('#ffa500', 'Orange'),
        ('#000000', 'Black')
    ], 'Color GPS', default = '#0000ff', help = 'Color Vehicle', required = True)
    image_vehicle = fields.Selection([
        ('truck', 'Truck'),
        ('vehicle', 'Vehicle'),
        ('backhoe', 'Backhoe'),
        ], 'Img GPS', default = 'truck', help = 'Image of GPS Vehicle', required = True)

    """
    def local_timezone(self, time, tz):
        time_zone = time.replace(tzinfo=pytz.utc)
        return time_zone.astimezone(pytz.timezone(tz)).strftime("%Y-%m-%d %H:%M:%S")
    """

    def get_last_vehicle_position(self):
        positions_arg = [('positionid', '!=', False)]
        vehicles = self.search(positions_arg)
        positions = {}
        tz = pytz.timezone(self.env.user.tz) if self.env.user.tz else pytz.utc
        for vehicle in vehicles:
            pos = vehicle["positionid"]

            devicetime = fields.Datetime.context_timestamp(self, pos.devicetime)
            fixtime = fields.Datetime.context_timestamp(self, pos.fixtime)

            status=pos.status
            if(status in ("Online","Alarm")):
                time_now = datetime.datetime.utcnow()
                time_before = time_now - datetime.timedelta(minutes = 15)

                if(pos.devicetime < time_before):
                    status = "Offline"

            position = pos.js_positions(vehicle, pos)
            """
            position = {
                "idv": vehicle["id"],
                "idg": pos.deviceid.id,
                "nam": vehicle["name"],
                "eco": vehicle["economic_number"],
                "lic": vehicle["license_plate"],
                "col": vehicle["color_vehicle"],
                "ima": vehicle["image_vehicle"],
                "vsp": vehicle["speed"],
                "oun": vehicle["odometer_unit"],
                "idp": pos.id,
                "lat": pos.latitude,
                "lon": pos.longitude,
                "alt": pos.altitude,
                "psp": pos.speed,
                "tde": devicetime,
                "dat": devicetime.strftime("%Y-%m-%d"),
                "tim": devicetime.strftime("%H:%M"),
                "tse": pos.servertime,
                "tfi": pos.fixtime,
                "tfi": fixtime,
                "sta": status,
                "eve": pos.event,
                "gas": pos.gas,
                "dis": pos.distance,
                "dto": pos.totalDistance,
                "cou": pos.course,
                "bat": pos.batery,
            }
            """
            if(pos.deviceid.id>0):
                positions[pos.deviceid.id] = {0: position}
        return positions

    def send_command(self, vals):
        host, session = self.env['res.config.settings'].sudo()._get_session_information()

        vehicle = self.search([["gps1_id","=", int(vals["data"])]])
        device=vehicle.gps1_id

        if(vehicle.engine==True):
            command="engineStop"
        else:
            command="engineResume"
        
        data = {
            "atributes":{},
            "deviceId": vehicle.gps1_id.solesgps_id,
            "type": command
        }        
        response = session.post(
            f"{host}/commands/send",
            json=data
        )        
        
        if response.status_code not in (200,202,204):
            raise UserError(f"Error actualizando Traccar: {response.text}")

        data=response.text
       
        if command =="engineResume":
            vehicle.engine=True
        else:
            vehicle.engine=False        
        return data
 
    def run_scheduler_set_odometer(self):
        for vehicle in self.search([]):
            
            if(vehicle.odometer_unit=='miles'):
                type_distance = 1609.34
            else:
                type_distance = 1000

            self.create({
                "vehicle_id": vehicle.id,
                "value": int(vehicle.positionid.totalDistance) / type_distance,
                "date": vehicle.positionid.devicetime,                
                "activeTime": int(vehicle.active_time_today) / 60,
            })
            vehicle.active_time_today=0
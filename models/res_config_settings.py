from odoo import fields, models
import requests
import re

class ResConfigSettings(models.TransientModel):
    _inherit = ['res.config.settings']

    sync_devices = fields.Boolean(config_parameter='gpsmap.sync_devices')

    def _get_session_information(self):
        host = self.env['ir.config_parameter'].sudo().get_param('gps_host')
        user = self.env['ir.config_parameter'].sudo().get_param('gps_user')
        password = self.env['ir.config_parameter'].sudo().get_param('gps_pass')

        if not host or not user or not password:
            raise UserError("Incomplete Traccar configuration")

        host = f"{host}/api"
        session = requests.Session()

        print(session)
        try:
            session.post(f"{host}/session", data={
                "email": user,
                "password": password
            })        
            print(session)
            
            return host, session  
        except requests.exceptions.RequestException as e:
            raise UserError(f"Error connecting to Traccar: {str(e)}")

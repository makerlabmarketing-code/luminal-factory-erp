"""Build the five current transactional email templates without changing placeholders."""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'docs/email-brand'
OUT.mkdir(parents=True, exist_ok=True)
LOGO = 'https://erp.luminalfactory.com/brand/luminal-factory-logo-gold-20261007.png'
def p(text):
    return f'<p style="margin-top:0;margin-bottom:18px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#cbd1d8;">{text}</p>'
def detail(rows):
    cells = ''.join(f'<tr><td style="padding-top:10px;padding-bottom:10px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#aeb6c2;">{a}</td><td align="right" style="padding-top:10px;padding-bottom:10px;padding-left:16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#f5f3ed;overflow-wrap:anywhere;">{b}</td></tr>' for a,b in rows)
    return f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;border-top:1px solid #58462c;border-bottom:1px solid #58462c;">{cells}</table>'
def shell(title, label, content, lang='en', internal=False):
    destination = 'https://erp.luminalfactory.com/staff/payroll' if internal else 'https://luminalfactory.com/en/support'
    action = 'Xem bảng lương của bạn' if internal else 'Contact Luminal Factory'
    footer = 'Thông báo từ hệ thống vận hành Luminal Factory.' if internal else 'Shaped by light. Crafted to last.'
    return f'''<!DOCTYPE html>
<html lang="{lang}" dir="ltr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>{title}</title></head>
<body style="margin:0;padding:0;background-color:#050608;">
<table lang="{lang}" dir="ltr" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#050608"><tr><td align="center" style="padding-top:32px;padding-bottom:32px;padding-left:12px;padding-right:12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#0d1015" style="max-width:600px;border:1px solid #8b6d41;border-radius:22px;"><tr><td style="padding-top:8px;padding-bottom:8px;padding-left:8px;padding-right:8px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#0b0e13" style="border:1px solid #58462c;border-radius:15px;">
<tr><td style="padding-top:26px;padding-bottom:24px;padding-left:24px;padding-right:24px;border-bottom:1px solid #58462c;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td width="72" valign="middle"><img src="{LOGO}" width="60" height="60" border="0" alt="" style="display:block;width:60px;height:60px;"></td><td valign="middle"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;letter-spacing:2px;color:#f4dfa0;">LUMINAL FACTORY</p><p style="margin-top:4px;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;letter-spacing:1px;color:#aeb6c2;">ARTISAN OBJECTS · SHAPED BY LIGHT</p></td></tr></table>
</td></tr>
<tr><td style="padding-top:30px;padding-bottom:30px;padding-left:24px;padding-right:24px;">
<p style="margin-top:0;margin-bottom:12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;letter-spacing:2px;color:#75d7f4;">{label}</p>
<h1 style="margin-top:0;margin-bottom:24px;font-family:Arial,Helvetica,sans-serif;font-size:30px;line-height:38px;font-weight:400;color:#f5f3ed;">{title}</h1>
{content}
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#171710" style="border:1px solid #b38c50;border-radius:8px;"><a href="{destination}" style="display:inline-block;padding-top:13px;padding-bottom:13px;padding-left:20px;padding-right:20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#f4dfa0;text-decoration:none;">{action} &#8599;</a></td></tr></table>
</td></tr>
<tr><td style="padding-top:22px;padding-bottom:24px;padding-left:24px;padding-right:24px;border-top:1px solid #58462c;"><p style="margin-top:0;margin-bottom:8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#aeb6c2;">{footer}</p><a href="https://luminalfactory.com" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#d4aa58;text-decoration:none;">Luminal Factory — artisan keycaps</a></td></tr>
</table></td></tr></table>
</td></tr></table></body></html>'''

templates = [
  (7,'RAFFLE_ENTRY_RECEIVED','Entry received','RAFFLE · ENTRY',p('Hi {{customer_name}},')+p('Your raffle entry has been received successfully.')+p('This entry is not an order and does not guarantee a purchase.')+p('We will contact you again only if your entry advances in the raffle flow.')),
  (8,'RAFFLE_WINNER_PAYMENT_REQUEST','Your allocation is ready','RAFFLE · PAYMENT REQUEST',p('Hi {{customer_name}},')+p('Your raffle entry has been confirmed as a winner allocation.')+detail([('Order reference','{{order_id}}'),('Total amount due','{{amount}}')])+p('Please follow the payment instructions provided by Luminal Factory. Payment is considered complete only after our team verifies receipt.')),
  (9,'RAFFLE_PAYMENT_CONFIRMED','Payment confirmed','RAFFLE · PAYMENT',p('Hi {{customer_name}},')+p('We have confirmed payment for your order.')+detail([('Order reference','{{order_id}}'),('Confirmed amount','{{amount}}')])+p('Your keycap is now moving into fulfillment. Delivery timing will be communicated by the Luminal Factory team.')+p('Thank you.')),
  (10,'RAFFLE_ALLOCATION_CANCELLED','Allocation update','RAFFLE · UPDATE',p('Hi {{customer_name}},')+p('Your raffle allocation has been cancelled.')+detail([('Order reference','{{order_id}}')])+p('If you believe this is unexpected, please contact Luminal Factory support.')),
  (11,'SALARY_PAYMENT_CONFIRMED','Đã thanh toán lương','NHÂN SỰ · THÔNG BÁO THANH TOÁN',p('Chào {{employee_name}},')+p('Luminal Factory đã xác nhận thanh toán lương tháng <strong style="color:#f5f3ed;">{{salary_month}}</strong>.')+detail([('Số tiền','{{amount}} đồng'),('Ngày xác nhận','{{payment_date}}'),('Mã khoản chi','{{ledger_id}}')])+p('Bạn vui lòng kiểm tra tài khoản nhận tiền và liên hệ người quản lý nếu có sai lệch.')),
]
results=[]
for id,group,title,label,content in templates:
    html=shell(title,label,content,lang='vi' if id==11 else 'en',internal=id==11)
    (OUT/f'{group.lower()}.html').write_text(html)
    results.append({'id':id,'group':group,'html':html})
(OUT/'templates.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
sample = results[-1]['html']
for key,value in {'employee_name':'Nhân sự thử nghiệm','salary_month':'01/2026','amount':'100.000','payment_date':'01/02/2026','ledger_id':'TEST-001'}.items():
    sample=sample.replace('{{'+key+'}}',value)
(OUT/'preview-salary.html').write_text(sample)
print(f'Built {len(results)} templates in {OUT}')

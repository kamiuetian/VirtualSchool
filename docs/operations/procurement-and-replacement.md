# Procurement, shipment, RMA, and replacement

Procurement batches are tenant-scoped and move forward one state at a time: `PURCHASED`, `RECEIVED`, `ENROLLING`, `READY`, `SHIPPED`, `ASSIGNED`, and `CLOSED`. Shipment transitions require a carrier, tracking number, and destination. Serial-numbered procurement items can only link to an enrolled device in the same tenant with the same serial number.

RMA updates retain the vendor RMA number and reason and add custody evidence whenever an enrolled device is involved. Operators should record the request before shipment and mark the item replaced only after the vendor outcome is known.

Device replacement requires an unassigned, non-retired replacement device in the same tenant. The operation atomically closes the original assignment, retires the original device, transfers its student/class/branch assignment and tags, opens assignment history on the replacement, creates custody events on both devices, writes linked support notes, and records an audit event. Existing support notes remain attached to the original device and therefore remain available as its service history.
